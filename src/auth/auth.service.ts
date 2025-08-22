
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { CREATOR_ONBOARDING_STATUS, Role, User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { ChangePasswordDto, ForgotPasswordDto, RefreshTokenDto, ResetPasswordDto, SignInDto, SignUpDto, SignupImageDto } from './dto/create-auth.dto';
import { MailService } from 'src/mail/mail.service';
import { REFRESH_TOKEN_EXPIRY } from './constants';
import { SpacesService } from 'src/spaces/spaces.service';

@Injectable()
export class AuthService {
  private readonly frontendUrl: string;

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private configService: ConfigService,
    private mailService: MailService,
    private spacesService: SpacesService,
  ) { 
    this.frontendUrl = this.configService.get<string>('server.frontendUrl') || '';
   }

  async signup(signUpDto: SignUpDto & SignupImageDto): Promise<void> {
    try {
      const { password, email, userName, ...userData } = signUpDto;
      let profileImageUrl: string | undefined;
      let bannerImageUrl: string | undefined;

      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { email },
            { userName }
          ]
        }
      });

      if (existingUser) {
        throw new BadRequestException('User with this email or username already exists');
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const verificationExpiry = new Date(Date.now() + 10 * 60 * 1000);

      const data = {
        userName,
        email,
        password: hashedPassword,
        dateOfBirth: new Date(userData.dateOfBirth),
        role: userData.role,
        gender: userData.gender,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phoneNumber: userData.phoneNumber,
        street: userData.street,
        city: userData.city,
        state: userData.state,
        zip: userData.zip,
        isEmailVerified: false,
        emailVerificationExpiry: verificationExpiry,
        countryCode: userData.countryCode,
        ...(userData.role === Role.creator && {
          onBoarding: CREATOR_ONBOARDING_STATUS.PENDING,
        }),
        oppVerification: {
          create_merchant_and_bank: false,
          bank_verification: false,
          identity_verification: false,
          additional_verification: false,
        }
      }
      const encryptedEmail = await bcrypt.hash(email, 10);
      const encodedVerificationCode = encodeURIComponent(encryptedEmail);
      await this.mailService.sendVerificationEmail(email, encodedVerificationCode, this.frontendUrl, userData.firstName);

      const createdUser = await this.prisma.user.create({
        data,
      });
      
      if (signUpDto?.profilePic && signUpDto.profilePic.length > 0) {
        const profileImage = signUpDto.profilePic[0];
        
        this.spacesService.validateFile(profileImage, 'image');

        profileImageUrl = await this.spacesService.uploadFile(
          profileImage,
          `${createdUser.id}/${profileImage.originalname}`,
          {
            resize: { width: 300, height: 300 }, // Square profile image
            quality: 85,
          }
        );
      }

      if (signUpDto?.bannerImage && signUpDto.bannerImage.length > 0) {
        const bannerImage = signUpDto.bannerImage[0];
        this.spacesService.validateFile(bannerImage, 'image');
        
        bannerImageUrl = await this.spacesService.uploadFile(
          bannerImage,
          `${createdUser.id}/${bannerImage.originalname}`,
          {
            resize: { width: 1200, height: 400 },
            quality: 85,
          }
        );
      }

      await this.prisma.user.update({
        where: { id: createdUser.id },
        data: {
          profilePic: profileImageUrl,
          bannerImage: bannerImageUrl,
        }
      });
    } catch (error) {
      throw error;
    }
  }

  async signIn(signInDto: SignInDto): Promise<{ accessToken: string; refreshToken: string; user: Omit<User, 'password' | 'refreshToken' | 'resetToken' | 'resetTokenExpiry' | 'refreshTokenExpiry'> }> {
    const { userNameOrEmail, password } = signInDto;
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { userName: userNameOrEmail },
          { email: userNameOrEmail },
        ],
        isActive: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      const encryptedEmail = await bcrypt.hash(user.email, 10);
      const encodedVerificationCode = encodeURIComponent(encryptedEmail);
      await this.mailService.sendVerificationEmail(user.email, encodedVerificationCode, this.frontendUrl, user.firstName);
      throw new UnauthorizedException('Please verify your email address before logging in');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    // Generate JWT token
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user);
    const { password: _, resetToken, resetTokenExpiry, refreshToken: __, refreshTokenExpiry: ___, ...userWithoutSensitiveData } = user;

    return {
      accessToken,
      refreshToken,
      user: userWithoutSensitiveData,
    };
  }

  async refreshAccessToken(refreshTokenDto: RefreshTokenDto): Promise<{ accessToken: string; refreshToken?: string; }> {
    const { refreshToken } = refreshTokenDto;

    let payload;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('server.jwt.secret'),
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token format');
    }

    // Find user with this refresh token
    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        refreshToken,
        refreshTokenExpiry: {
          gt: new Date(),
        },
        isActive: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Generate new tokens
    const newAccessToken = this.generateAccessToken(user);
    if (user.refreshTokenExpiry) {
      const refreshTokenExpiryBuffer = 2 * 24 * 60 * 60 * 1000;
      const shouldRenewRefreshToken = user.refreshTokenExpiry.getTime() - Date.now() < refreshTokenExpiryBuffer;
      let newRefreshToken;
      if (shouldRenewRefreshToken) {
        newRefreshToken = await this.generateRefreshToken(user);
        return {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        };
      }
    } else {
      const newRefreshToken = await this.generateRefreshToken(user);
      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    }

    return {
      accessToken: newAccessToken
    };
  }

  async logout(userId: string): Promise<{ message: string }> {
    // Clear refresh token from database
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        resetToken: null,
        resetTokenExpiry: null,
        refreshToken: null,
        refreshTokenExpiry: null,
      },
    });

    return { message: 'Logout successful' };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<{ message: string }> {
    const { email } = forgotPasswordDto;

    const user = await this.prisma.user.findUnique({
      where: { email, isActive: true },
    });
    if (!user) {
      throw new NotFoundException('User with this email does not exist');
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    // Save reset token to database
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // Send reset email
    await this.mailService.sendPasswordResetEmail(user.email, resetToken);

    return { message: 'Password reset email sent successfully' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    const { token, newPassword } = resetPasswordDto;

    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date(),
        },
        isActive: true,
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password and clear reset token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return { message: 'Password reset successfully' };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<{ message: string }> {
    const { oldPassword, newPassword } = changePasswordDto;

    // Validate input
    if (!oldPassword || !newPassword) {
      throw new BadRequestException('Old password and new password are required');
    }

    if (oldPassword === newPassword) {
      throw new BadRequestException('New password must be different from old password');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId, isActive: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify old password
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password and clear all tokens for security
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedNewPassword,
        refreshToken: null,
        refreshTokenExpiry: null,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return { message: 'Password changed successfully. Please login again.' };
  }

  async verifyEmail(code: string): Promise<{ message: string }> {
    try {
      // Decode the URL-encoded verification code
      const decodedCode = decodeURIComponent(code);
      
      // Find all users with unverified emails
      const unverifiedUsers = await this.prisma.user.findMany({
        where: {
          isEmailVerified: false,
          emailVerificationExpiry: {
            gt: new Date(), // Token hasn't expired
          },
        },
      });

      // Check which user's email matches the encrypted code
      let matchedUser: User | null = null;
      for (const user of unverifiedUsers) {
        const isMatch = await bcrypt.compare(user.email, decodedCode);
        if (isMatch) {
          matchedUser = user;
          break;
        }
      }

      if (!matchedUser) {
        throw new BadRequestException('Invalid or expired verification link');
      }

      // Update user to verified
      await this.prisma.user.update({
        where: { id: matchedUser.id },
        data: {
          isEmailVerified: true,
          emailVerificationExpiry: null,
        },
      });

      return { message: 'Email verified successfully' };
    } catch (error) {
      throw new BadRequestException('Invalid verification code');
    }
  }

  async resendVerificationEmail(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    const verificationExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationExpiry: verificationExpiry,
      },
    });

    // Send new verification email
    const encryptedEmail = await bcrypt.hash(email, 10);
    const encodedVerificationCode = encodeURIComponent(encryptedEmail);
    await this.mailService.sendVerificationEmail(email, encodedVerificationCode, this.frontendUrl, user.firstName);

    return { message: 'Verification email sent successfully' };
  }

  async validateUser(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id: userId, isActive: true },
    });
  }

  private async generateRefreshToken(user: User): Promise<string> {
    const payload = {
      sub: user.id,
      type: 'refresh', // Token type
    };

    // Generate refresh token with longer expiration (7 days)
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('server.jwt.secret'),
      expiresIn: '7d',
    });

    // Save refresh token to database with expiry
    const refreshTokenExpiry = new Date(Date.now() + REFRESH_TOKEN_EXPIRY); // 7 days

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken,
        refreshTokenExpiry,
      },
    });

    return refreshToken;
  }

  private generateAccessToken(user: User): string {
    const payload = {
      sub: user.id,
      userName: user.userName,
      email: user.email,
      role: user.role,
      type: 'access', // Token type
    };
    return this.jwtService.sign(payload);
  }
}
