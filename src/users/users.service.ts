import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { DeactivateUserDto } from './dto/deactivate-user.dto';
import { UserSearchResponseDto } from './dto/user-search-response.dto';
import { UpdateUserDto, UserProfileResponseDto } from './dto/update-user.dto';
import { OppService } from 'src/creator/opp/opp.service';
import { OppMerchantUpdateData } from 'src/creator/opp/opp.interface';
import * as crypto from 'crypto';
import { MailService } from 'src/mail/mail.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersService {
  private readonly frontendUrl: string;

  constructor(
    private prisma: PrismaService, 
    private oppService: OppService, 
    private mailService: MailService,
    private configService: ConfigService
  ) { 
    this.frontendUrl = this.configService.get<string>('server.frontendUrl') || '';
  }

  async getAllUsers() {
    return this.prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        userName: true,
        firstName: true,
        lastName: true,
        email: true,
        cocNr: true,
        phoneNumber: true,
        dateOfBirth: true,
        gender: true,
        profilePic: true,
        bannerImage: true,
        role: true,
        countryCode: true,
        overviewUrl: true,
        oppVerification: true,
        onBoarding: true,
        createdAt: true,
        updatedAt: true
      },
    });
  }

  async currentUser(userId: string) {
    return await this.getUserById(userId);
  }

  async getUserById(
    id: string,
  ): Promise<
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
    >
  > {
    const user = await this.prisma.user.findUnique({
      where: { id, isActive: true, isEmailVerified: true },
      select: {
        id: true,
        userName: true,
        firstName: true,
        lastName: true,
        email: true,
        cocNr: true,
        phoneNumber: true,
        dateOfBirth: true,
        gender: true,
        profilePic: true,
        bannerImage: true,
        role: true,
        countryCode: true,
        overviewUrl: true,
        oppVerification: true,
        onBoarding: true,
        createdAt: true,
        updatedAt: true
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return user;
  }

  async searchUsersByUsername(username: string): Promise<UserSearchResponseDto[]> {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          userName: {
            contains: username,
            mode: 'insensitive',
          },
          isActive: true,
          isEmailVerified: true
        },
        select: {
          id: true,
          userName: true,
          firstName: true,
          lastName: true,
          profilePic: true,  
        },
        take: 20, // Limit results for performance
        orderBy: {
          userName: 'asc',
        },
      });

      return users.map(user => new UserSearchResponseDto(user));
    } catch (error) {
      console.log(error)
      throw error;
    }
  }

  async deactivateUser(userId: string, deactivateDto: DeactivateUserDto): Promise<{ message: string }> {
    // Find user and verify existence
    const user = await this.prisma.user.findUnique({
      where: { id: userId, isEmailVerified: true },
      select: {
        id: true,
        password: true,
        isActive: true,
        merchantUid: true,
        userName: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.isActive) {
      throw new BadRequestException('User account is already deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(deactivateDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password provided');
    }

    try {
      // Deactivate user (soft delete) and clear sensitive tokens
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          isActive: false,
          refreshToken: null,
          refreshTokenExpiry: null,
          resetToken: null,
          resetTokenExpiry: null,
          updatedAt: new Date(),
        },
      });

      // Terminated merchant in opp platform
      if (user.merchantUid) {
        await this.oppService.updateMerchant(user.merchantUid, { status: 'terminated' });
      }

      return {
        message: 'Your account has been successfully deactivated. All active sessions have been invalidated.',
      };
    } catch (error) {
      throw error;
    }
  }

  private buildOppUpdateData(existingUser: any, updateData: UpdateUserDto): OppMerchantUpdateData {
    const oppData: OppMerchantUpdateData = {};

    if (updateData.email && updateData.email !== existingUser.email) {
      oppData.emailaddress = updateData.email;
    }

    if (updateData.phoneNumber && updateData.phoneNumber !== existingUser.phoneNumber) {
      oppData.phone = updateData.phoneNumber;
    }

    if (updateData.countryCode && updateData.countryCode !== existingUser.countryCode) {
      // Convert country code to OPP format (ISO 3166-1 alpha-3)
      oppData.country = updateData.countryCode;
    }
    return oppData;
  }

  async updateUserProfile(userId: string, updateData: UpdateUserDto): Promise<UserProfileResponseDto> {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId, isEmailVerified: true },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    if (!existingUser.isActive) {
      throw new BadRequestException('User account is already deactivated');
    }

    // Check for username uniqueness if updating username
    if (updateData.userName && updateData.userName !== existingUser.userName) {
      const userWithSameUsername = await this.prisma.user.findUnique({
        where: { userName: updateData.userName, isEmailVerified:true },
      });

      if (userWithSameUsername) {
        throw new ConflictException('Username already exists');
      }
    }

    // Check for email uniqueness if updating email
    if (updateData.email && updateData.email !== existingUser.email) {
      const userWithSameEmail = await this.prisma.user.findUnique({
        where: { email: updateData.email },
      });

      if (userWithSameEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    let oppUpdateData: OppMerchantUpdateData | null = null;
    if (existingUser.merchantUid) {
      oppUpdateData = this.buildOppUpdateData(existingUser, updateData);
    }

    try {
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: {
          ...updateData,
          dateOfBirth: updateData.dateOfBirth ? new Date(updateData.dateOfBirth) : undefined,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          userName: true,
          firstName: true,
          lastName: true,
          email: true,
          cocNr: true,
          phoneNumber: true,
          dateOfBirth: true,
          gender: true,
          profilePic: true,
          bannerImage: true,
          role: true,
          countryCode: true,
          overviewUrl: true,
          oppVerification: true,
          onBoarding: true,
          createdAt: true,
          updatedAt: true
        },
      });

      if (oppUpdateData && existingUser.merchantUid) {
        await this.oppService.updateMerchant(existingUser.merchantUid, oppUpdateData);
      }

      return new UserProfileResponseDto(updatedUser);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = error.meta?.target as string[];
          if (target?.includes('userName')) {
            throw new ConflictException('Username already exists');
          }
          if (target?.includes('email')) {
            throw new ConflictException('Email already exists');
          }
        }
      }
      throw error;
    }
  }

  async getUsersByRole(role: Role) {
    return this.prisma.user.findMany({
      where: { role, isActive: true },
      select: {
        id: true,
        userName: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  }
}
