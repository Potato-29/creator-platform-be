import { BadRequestException, HttpException, HttpStatus, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';
import { HttpService } from '@nestjs/axios';
import { CreateBankAccountRequest, CreateBankAccountResponse, CreateMerchantRequest, CreateMerchantResponse, OppApiError, OppMerchantUpdateData } from './opp.interface';

@Injectable()
export class OppService {
    private readonly logger = new Logger(OppService.name);
    private readonly baseUrl: string;
    private readonly apiKey: string;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        // Use sandbox URL for testing, production URL for live
        this.baseUrl = this.configService.get<string>('server.oppSecret.oppBaseUrl') ?? ''
        this.apiKey = this.configService.get<string>('server.oppSecret.apiKey') ?? '';
    }

    private getHeaders() {
        return {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
        };
    }

    async createMerchant(merchantData: CreateMerchantRequest): Promise<CreateMerchantResponse> {
        try {
            this.logger.log(`Creating business merchant for email: ${merchantData.emailaddress}`);

            // Validate required fields
            if (!merchantData.type) {
                throw new BadRequestException('Type is required');
            }
            if (!merchantData.coc_nr) {
                throw new BadRequestException('Chamber of Commerce number (coc_nr) is required');
            }
            if (!merchantData.emailaddress) {
                throw new BadRequestException('Email address is required');
            }
            if (!merchantData.country) {
                throw new BadRequestException('Country is required');
            }
            if (!merchantData.phone) {
                throw new BadRequestException('Phone Number is required');
            }
            if (!merchantData.notify_url) {
                throw new BadRequestException('Notify URL is required');
            }

            const response: AxiosResponse<CreateMerchantResponse> = await firstValueFrom(
                this.httpService.post(
                    `${this.baseUrl}/merchants`,
                    merchantData,
                    { headers: this.getHeaders() }
                )
            );

            this.logger.log(`Business merchant created successfully with UID: ${response.data.uid}`);
            return response.data;
        } catch (error) {
            this.logger.error('Failed to create business merchant', error.response?.data || error.message);

            if (error.response?.data?.error) {
                const oppError: OppApiError = error.response.data;
                throw new BadRequestException(`OPP API Error: ${oppError.error.message}`);
            }

            throw new InternalServerErrorException('Failed to create business merchant');
        }
    }

    async createBankAccount(merchantUid: string, bankAccountData: CreateBankAccountRequest): Promise<CreateBankAccountResponse> {
        try {
            this.logger.log(`Creating bank account for merchant: ${merchantUid}`);

            if (!merchantUid) {
                throw new BadRequestException('Merchant UID is required');
            }
            if (!bankAccountData.return_url) {
                throw new BadRequestException('Return URL is required');
            }
            if (!bankAccountData.notify_url) {
                throw new BadRequestException('Notify URL is required');
            }

            const response: AxiosResponse<CreateBankAccountResponse> = await firstValueFrom(
                this.httpService.post(
                    `${this.baseUrl}/merchants/${merchantUid}/bank_accounts`,
                    bankAccountData,
                    { headers: this.getHeaders() }
                )
            );

            this.logger.log(`Bank account created successfully with UID: ${response.data.uid}`);
            return response.data;
        } catch (error) {
            this.logger.error('Failed to create bank account', error.response?.data || error.message);

            if (error.response?.data?.error) {
                const oppError: OppApiError = error.response.data;
                throw new BadRequestException(`OPP API Error: ${oppError.error.message}`);
            }

            throw new InternalServerErrorException('Failed to create bank account');
        }
    }

    async updateMerchant(merchantUid: string, updateData: OppMerchantUpdateData): Promise<CreateMerchantResponse> {
        if (!merchantUid) {
            throw new HttpException('Merchant UID is required for OPP update', HttpStatus.BAD_REQUEST);
        }

        try {
            this.logger.log(`Updating OPP merchant: ${merchantUid}`, updateData);

            const response: AxiosResponse<CreateMerchantResponse> = await firstValueFrom(
                this.httpService.post(
                    `${this.baseUrl}/merchants/${merchantUid}`,
                    updateData,
                    {
                        headers: this.getHeaders()
                    }
                )
            );

            this.logger.log(`Successfully updated OPP merchant: ${merchantUid}`);
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to update OPP merchant: ${merchantUid}`, {
                error: error.message,
                response: error.response?.data,
                status: error.response?.status,
            });

            // Don't throw the error to prevent user update failure due to OPP issues
            // Log the error and continue with user update
            if (error.response?.status === 404) {
                this.logger.warn(`OPP Merchant not found: ${merchantUid}. This might be normal if merchant was not created in OPP yet.`);
            } else if (error.response?.status === 401) {
                this.logger.error('OPP API authentication failed. Please check API key.');
            } else {
                this.logger.error('OPP API update failed with unexpected error', error);
            }

            throw new InternalServerErrorException('Failed to update merchant');
        }
    }

    async getMerchant(merchantUid: string): Promise<CreateMerchantResponse> {
        try {
            this.logger.log(`Retrieving merchant details for: ${merchantUid}`);

            const response: AxiosResponse<CreateMerchantResponse> = await firstValueFrom(
                this.httpService.get(
                    `${this.baseUrl}/merchants/${merchantUid}`,
                    { headers: this.getHeaders() }
                )
            );

            return response.data;
        } catch (error) {
            this.logger.error('Failed to retrieve merchant', error.response?.data || error.message);

            if (error.response?.data?.error) {
                const oppError: OppApiError = error.response.data;
                throw new BadRequestException(`OPP API Error: ${oppError.error.message}`);
            }

            throw new InternalServerErrorException('Failed to retrieve merchant');
        }
    }

    async getBankAccount(merchantUid: string, bankAccountUid: string): Promise<CreateBankAccountResponse> {
        try {
            this.logger.log(`Retrieving bank account ${bankAccountUid} for merchant: ${merchantUid}`);

            const response: AxiosResponse<CreateBankAccountResponse> = await firstValueFrom(
                this.httpService.get(
                    `${this.baseUrl}/merchants/${merchantUid}/bank_accounts/${bankAccountUid}`,
                    { headers: this.getHeaders() }
                )
            );

            return response.data;

        } catch (error) {
            this.logger.error('Failed to retrieve bank account', error.response?.data || error.message);

            if (error.response?.data?.error) {
                const oppError: OppApiError = error.response.data;
                throw new BadRequestException(`OPP API Error: ${oppError.error.message}`);
            }

            throw new InternalServerErrorException('Failed to retrieve bank account');
        }
    }
}