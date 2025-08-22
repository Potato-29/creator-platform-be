import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OppService } from './opp/opp.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { CREATOR_ONBOARDING_STATUS, User } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { OnboardCreatorDto, OnboardResponseDto } from './dto/onboard-creator.dto';
import { WebhookNotificationDto } from './dto/webhook-notification.dto';
import { MailService } from 'src/mail/mail.service';
import { CreateBankAccountRequest, CreateMerchantRequest, CreateMerchantResponse } from './opp/opp.interface';
import { UsersService } from 'src/users/users.service';

type OnboardingUser =
    Pick<
        User,
        | 'id'
        | 'userName'
        | 'firstName'
        | 'lastName'
        | 'email'
        | 'cocNr'
        | 'phoneNumber'
        | 'dateOfBirth'
        | 'gender'
        | 'profilePic'
        | 'bannerImage'
        | 'role'
        | 'countryCode'
        | 'overviewUrl'
        | 'oppVerification'
        | 'onBoarding'
        | 'createdAt'
        | 'updatedAt'
    > &
    Partial<Pick<User, 'merchantUid' | 'bankAccountUid'>>;

@Injectable()
export class CreatorService {
    private readonly notifyUrl: string | undefined;

    constructor(
        private readonly oppService: OppService, 
        private prisma: PrismaService, 
        private readonly configService: ConfigService, 
        private readonly mailService: MailService, 
        private usersService: UsersService
    ) {
        this.notifyUrl = this.configService.get<string>('server.oppSecret.notificationUrl');
    }

    async onboardCreator(userId: string, dto: OnboardCreatorDto): Promise<OnboardResponseDto> {
        const user = await this.usersService.getUserById(userId)

        if (!user) {
            throw new NotFoundException('User not found');
        }
        if (!dto.cocNr && !user.cocNr) {
            throw new NotFoundException('coc nr not found');
        }

        try {
            switch (user.onBoarding) {
                case CREATOR_ONBOARDING_STATUS.PENDING:
                case CREATOR_ONBOARDING_STATUS.CREATE_MERCHANT_FAILED:
                    return await this.handleCreateMerchant(user, dto);

                case CREATOR_ONBOARDING_STATUS.CREATE_BANK_ACCOUNT_PENDING:
                case CREATOR_ONBOARDING_STATUS.CREATE_BANK_ACCOUNT_FAILED:
                    return await this.handleCreateBankAccount(user);

                case CREATOR_ONBOARDING_STATUS.BANK_VERIFICATION_PENDING:
                case CREATOR_ONBOARDING_STATUS.BANK_VERIFICATION_FAILED:
                    return await this.handleBankVerification(user);

                case CREATOR_ONBOARDING_STATUS.IDENTITY_VERIFICATION_PENDING:
                case CREATOR_ONBOARDING_STATUS.IDENTITY_VERIFICATION_FAILED:
                    return await this.handleIdentityVerification(user);

                case CREATOR_ONBOARDING_STATUS.ADDITIONAL_REQUIREMENT_PENDING:
                case CREATOR_ONBOARDING_STATUS.ADDITIONAL_REQUIREMENT_FAILED:
                    return await this.handleAdditionalRequirements(user);

                case CREATOR_ONBOARDING_STATUS.SUCCESS:
                    return {
                        success: true,
                        status: user.onBoarding,
                        message: 'Onboarding already completed successfully',
                    };

                default:
                    return {
                        success: true,
                        status: user.onBoarding || CREATOR_ONBOARDING_STATUS.PENDING,
                        message: 'Onboarding is in progress. Please wait for verification to complete.',
                    };
            }
        } catch (error) {
            return {
                success: false,
                status: user.onBoarding || CREATOR_ONBOARDING_STATUS.PENDING,
                message: error.message || 'Onboarding process failed',
            };
        }
    }

    private async handleCreateMerchant(user: OnboardingUser, dto: OnboardCreatorDto): Promise<OnboardResponseDto> {
        try {
            await this.updateUserStatus(user.id, CREATOR_ONBOARDING_STATUS.CREATE_MERCHANT_PENDING);
            const cocNr = dto.cocNr || user.cocNr;
            if (!cocNr) {
                throw new NotFoundException('cocNr not found');
            }
            if (!this.notifyUrl) {
                throw new Error('OPP notify URL is not configured');
            }
            if(!user.countryCode) {
                throw new BadRequestException('Country not found');
            }
            if(!user.phoneNumber) {
                throw new BadRequestException('Phone number not found');
            }
            const merchantRequest: CreateMerchantRequest = {
                type: 'business',
                coc_nr: cocNr,
                country: user.countryCode,
                emailaddress: user.email,
                phone: user.phoneNumber,
                notify_url: this.notifyUrl
            };
            const merchant = await this.oppService.createMerchant(merchantRequest);

            // Update user with merchant details
            await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    merchantUid: merchant.uid,
                    onBoarding: CREATOR_ONBOARDING_STATUS.CREATE_BANK_ACCOUNT_PENDING,
                    overviewUrl: merchant.compliance.overview_url,
                    cocNr: merchant.coc_nr
                },
            });

            // Immediately proceed to create bank account
            const updatedUser = await this.usersService.getUserById(user.id);
            if (!updatedUser) {
                throw new NotFoundException('User not found');
            }
            return await this.handleCreateBankAccount(updatedUser, merchant.compliance.overview_url);
        } catch (error) {
            await this.updateUserStatus(user.id, CREATOR_ONBOARDING_STATUS.CREATE_MERCHANT_FAILED);
            throw error;
        }
    }

    private async handleCreateBankAccount(user: OnboardingUser, overviewUrl?: string): Promise<OnboardResponseDto> {
        try {
            if (!user.merchantUid) {
                throw new Error('Merchant UID not found');
            }
            const { compliance, status } = await this.oppService.getMerchant(user.merchantUid)
            const finalOverviewUrl =
                overviewUrl || compliance?.overview_url;

            await this.updateUserStatus(user.id, CREATOR_ONBOARDING_STATUS.CREATE_BANK_ACCOUNT_PENDING);
            const returnUrl = this.configService.get<string>('server.oppSecret.returnUrl')
            if (!this.notifyUrl) {
                throw new Error('OPP notify URL is not configured');
            }

            const bankAccountRequest: CreateBankAccountRequest = {
                return_url: `${returnUrl}?userId=${user.id}`,
                notify_url: this.notifyUrl
            };
            const bankAccountResponse = await this.oppService.createBankAccount(user.merchantUid, bankAccountRequest);

            await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    bankAccountUid: bankAccountResponse.uid,
                    onBoarding: CREATOR_ONBOARDING_STATUS.BANK_VERIFICATION_PENDING,
                    oppVerification: {
                        create_merchant_and_bank: true,
                        bank_verification: false,
                        identity_verification: false,
                        additional_verification: false,
                        merchant_status: status
                    }
                },
            });

            return {
                success: true,
                status: CREATOR_ONBOARDING_STATUS.BANK_VERIFICATION_PENDING,
                message: 'First two steps completed successfully. Redirect to bank verification.',
                nextStep: 'bank_verification',
                redirectUrl: finalOverviewUrl,
            };
        } catch (error) {
            await this.updateUserStatus(user.id, CREATOR_ONBOARDING_STATUS.CREATE_BANK_ACCOUNT_FAILED);
            throw error;
        }
    }

    private async handleBankVerification(user: OnboardingUser): Promise<OnboardResponseDto> {
        try {
            if (!user.merchantUid) {
                throw new Error('Merchant UID not found');
            }
            if (!user.overviewUrl) {
                throw new Error('Merchant not found');
            }
            await this.updateUserStatus(user.id, CREATOR_ONBOARDING_STATUS.BANK_VERIFICATION_IN_PROGRESS);
            return {
                success: true,
                status: CREATOR_ONBOARDING_STATUS.BANK_VERIFICATION_IN_PROGRESS,
                message: 'Please complete bank verification',
                nextStep: 'bank_verification',
                redirectUrl: user.overviewUrl,
            };
        } catch (error) {
            await this.updateUserStatus(user.id, CREATOR_ONBOARDING_STATUS.BANK_VERIFICATION_FAILED);
            throw error;
        }
    }

    private async handleIdentityVerification(user: OnboardingUser): Promise<OnboardResponseDto> {
        try {
            if (!user.merchantUid) {
                throw new Error('Merchant UID not found');
            }
            if (!user.overviewUrl) {
                throw new Error('Merchant not found');
            }

            await this.updateUserStatus(user.id, CREATOR_ONBOARDING_STATUS.IDENTITY_VERIFICATION_IN_PROGRESS);
            return {
                success: true,
                status: CREATOR_ONBOARDING_STATUS.IDENTITY_VERIFICATION_IN_PROGRESS,
                message: 'Please complete identity verification',
                nextStep: 'identity_verification',
                redirectUrl: user.overviewUrl,
            };
        } catch (error) {
            await this.updateUserStatus(user.id, CREATOR_ONBOARDING_STATUS.IDENTITY_VERIFICATION_FAILED);
            throw error;
        }
    }

    private async handleAdditionalRequirements(user: OnboardingUser): Promise<OnboardResponseDto> {
        try {
            if (!user.merchantUid) {
                throw new Error('Merchant UID not found');
            }
            if (!user.overviewUrl) {
                throw new Error('Merchant not found');
            }
            await this.updateUserStatus(user.id, CREATOR_ONBOARDING_STATUS.ADDITIONAL_REQUIREMENT_IN_PROGRESS);
            return {
                success: true,
                status: CREATOR_ONBOARDING_STATUS.ADDITIONAL_REQUIREMENT_IN_PROGRESS,
                message: 'Please complete additional requirements',
                nextStep: 'additional_requirements',
                redirectUrl: user.overviewUrl,
            };
        } catch (error) {
            await this.updateUserStatus(user.id, CREATOR_ONBOARDING_STATUS.ADDITIONAL_REQUIREMENT_FAILED);
            throw error;
        }
    }

    async handleWebhookNotification(notification: WebhookNotificationDto): Promise<void> {
        try {
            switch (notification.type) {
                case 'bank_account.status.changed':
                    this.handleBankAccountChange(notification);
                    break;

                case 'contact.status.changed':
                    this.handleContactChange(notification);
                    break;

                case 'ubo.status.updated':
                    this.handleUboChange(notification);
                    break;

                case 'merchant.status.changed':
                case 'merchant.compliance_status.changed':
                    this.handleMerchantChange(notification)
                    break;
                default:
                    console.log(`Unhandled notification type: ${notification.type}`);
            }
        } catch (error) {
            throw error;
        }
    }

    private async handleBankAccountChange(notification: WebhookNotificationDto): Promise<void> {
        const user = await this.findUserByMerchantUid(notification.parent_uid)

        if (!user || !user.merchantUid || !user.overviewUrl) {
            return;
        }

        // Fetch updated merchant data from OPP
        const merchant = await this.oppService.getMerchant(user.merchantUid);
        // Check if bank_account requirement exists and its status
        const bankAccountRequirement = merchant.compliance.requirements.find(
            req => req.object_type === 'bank_account'
        );

        if (bankAccountRequirement?.status !== 'pending') {
            let verificationUpdates = {
                bank_verification: true,
                merchant_status: merchant.status
            };

            let sendSuccessEmail = false;
            if (bankAccountRequirement?.status === 'unverified') {
                verificationUpdates.bank_verification = false;
                sendSuccessEmail = false;
            } else {
                verificationUpdates.bank_verification = true;
                sendSuccessEmail = true;
            }
            await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    onBoarding: sendSuccessEmail ? CREATOR_ONBOARDING_STATUS.IDENTITY_VERIFICATION_PENDING : CREATOR_ONBOARDING_STATUS.IDENTITY_VERIFICATION_FAILED,
                    oppVerification: {
                        ...(user.oppVerification as Record<string, any>),
                        ...verificationUpdates,
                    }
                }
            });
            if (user.email) {
                await this.mailService.sendStepNotification(
                    user.firstName || '',
                    user.email,
                    sendSuccessEmail ? 'Bank verification step completed successfully' : 'Bank verification incomplete',
                    false,
                    user.overviewUrl,
                    sendSuccessEmail ? 'Bank verification steps completed successfully' : 'but unfortunately, Bank verification steps could not be completed successfully'
                );
            }
        }
    }

    private async handleContactChange(notification: WebhookNotificationDto): Promise<void> {
        const user = await this.prisma.user.findFirst({
            where: { merchantUid: notification.parent_uid , isActive: true, isEmailVerified: true },
            select: { id: true, merchantUid: true, email: true, oppVerification: true, overviewUrl: true, firstName: true }
        });

        if (!user || !user.merchantUid || !user.overviewUrl) {
            return;
        }

        // Fetch updated merchant data from OPP
        const merchant = await this.oppService.getMerchant(user.merchantUid);
        // Check if contact requirement exists and its status
        const contactRequirement = merchant.compliance.requirements.find(
            req => req.object_type === 'contact'
        );

        if (contactRequirement?.status !== 'pending') {
            let verificationUpdates = {
                identity_verification: true,
                merchant_status: merchant.status
            };

            let sendSuccessEmail = false;

            if (contactRequirement?.status === 'unverified') {
                verificationUpdates.identity_verification = false;
                sendSuccessEmail = false;
            } else {
                verificationUpdates.identity_verification = true;
                sendSuccessEmail = true;
            }

            await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    onBoarding: sendSuccessEmail ? 'ADDITIONAL_REQUIREMENT_PENDING' : 'ADDITIONAL_REQUIREMENT_FAILED',
                    oppVerification: {
                        ...(user.oppVerification as Record<string, any>),
                        ...verificationUpdates,
                    }
                }
            });

            if (user.email) {
                await this.mailService.sendStepNotification(
                    user.firstName || '',
                    user.email,
                    sendSuccessEmail ? 'Identity verification step completed successfully' : 'Identity verification incomplete',
                    false,
                    user.overviewUrl,
                    sendSuccessEmail ? 'Identity verification steps completed successfully' : 'but unfortunately, Identity verification steps could not be completed successfully'
                );
            }
        }
    }

    private async handleUboChange(notification: WebhookNotificationDto): Promise<void> {
        const user = await this.prisma.user.findFirst({
            where: { merchantUid: notification.parent_uid, isActive: true, isEmailVerified: true },
            select: { id: true, merchantUid: true, email: true, oppVerification: true, overviewUrl: true, firstName: true }
        });

        if (!user || !user.merchantUid || !user.overviewUrl) {
            return;
        }

        // Fetch updated merchant data from OPP
        const merchant = await this.oppService.getMerchant(user.merchantUid);
        // Check if ubo.required requirement exists and its status
        const uboRequirement = merchant.compliance.requirements.find(
            req => req.type === 'ubo.verification.required'
        );

        if (uboRequirement?.status !== 'pending') {
            let verificationUpdates = {
                additional_verification: true,
                merchant_status: merchant.status
            };

            let sendSuccessEmail = false;


            if (uboRequirement?.status === 'unverified') {
                verificationUpdates.additional_verification = false;
                sendSuccessEmail = false;
            } else {
                verificationUpdates.additional_verification = true;
                sendSuccessEmail = true;
            }

            await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    onBoarding: sendSuccessEmail ? 'SUCCESS' : 'ADDITIONAL_REQUIREMENT_FAILED',
                    oppVerification: {
                        ...(user.oppVerification as Record<string, any>),
                        ...verificationUpdates,
                    }
                }
            });

            if (user.email) {
                await this.mailService.sendStepNotification(
                    user.firstName || '',
                    user.email,
                    sendSuccessEmail ? 'Additional verification step completed successfully' : 'Additional verification incomplete',
                    false,
                    user.overviewUrl,
                    sendSuccessEmail ? 'Additional verification steps completed successfully' : 'but unfortunately, Additional verification steps could not be completed successfully'
                );
            }
        }
    }

    private async handleMerchantChange(notification: WebhookNotificationDto): Promise<void> {
        const user = await this.prisma.user.findFirst({
            where: { merchantUid: notification.object_uid, isActive: true, isEmailVerified: true },
            select: { id: true, merchantUid: true, email: true, oppVerification: true, overviewUrl: true, firstName: true }
        });

        if (!user || !user.merchantUid || !user.overviewUrl) {
            return;
        }

        // Fetch updated merchant data from OPP
        const merchant = await this.oppService.getMerchant(user.merchantUid);
        let verificationUpdates = {
            merchant_status: merchant.status
        };

        let sendSuccessEmail = false;

        if (merchant.compliance.status === 'verified' && merchant.status === 'live') {
            verificationUpdates.merchant_status = merchant.status;
            sendSuccessEmail = true;
        } else {
            verificationUpdates.merchant_status = merchant.status;
            sendSuccessEmail = false;
        }

        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                onBoarding: CREATOR_ONBOARDING_STATUS.SUCCESS,
                oppVerification: {
                    ...(user.oppVerification as Record<string, any>),
                    ...verificationUpdates,
                }
            }
        });

        if (user.email) {
            await this.mailService.sendStepNotification(
                user.firstName || '',
                user.email,
                sendSuccessEmail ? 'Your account is now verified' : 'Verification incomplete – Action required',
                sendSuccessEmail,
                this.configService.get<string>('server.frontendUrl') || '',
            );
        }
    }

    private async findUserByMerchantUid(merchantUid: string | undefined): Promise<any | null> {
        if (!merchantUid) return null;

        return await this.prisma.user.findFirst({
            where: { merchantUid, isActive: true, isEmailVerified: true },
            select: {
                id: true,
                merchantUid: true,
                email: true,
                oppVerification: true,
                overviewUrl: true,
                firstName: true
            }
        });
    }

    private async updateUserStatus(userId: string, status: CREATOR_ONBOARDING_STATUS): Promise<void> {
        await this.prisma.user.update({
            where: { id: userId },
            data: {
                onBoarding: status,
            },
        });
    }
}