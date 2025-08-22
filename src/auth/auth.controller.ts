
import { Body, Controller, Post, HttpCode, HttpStatus, Res, BadRequestException, InternalServerErrorException, UnauthorizedException, UseGuards, Request, UseInterceptors, UploadedFiles, Get, Query } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { ChangePasswordDto, ForgotPasswordDto, RefreshTokenDto, ResetPasswordDto, SignInDto, SignUpDto } from './dto/create-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { setTokenCookies } from 'src/utils/lib';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { File as MulterFile } from 'multer';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService
  ) { }

  @Post('signup')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'profilePic', maxCount: 1 },
      { name: 'bannerImage', maxCount: 1 },
    ], {
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
    })
  )
  @HttpCode(HttpStatus.CREATED)
  async signUp(@Body() signUpDto: SignUpDto, @UploadedFiles() files: {
    profilePic?: MulterFile[];
    bannerImage?: MulterFile[];
  }) {
    try {
      const { profilePic, bannerImage } = files || {};
      await this.authService.signup({ ...signUpDto, profilePic, bannerImage });
      return {
        statusCode: HttpStatus.CREATED,
        message: 'User registered successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Something went wrong during registration');
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() signInDto: SignInDto, @Res({ passthrough: true }) res: Response) {
    try {
      const result = await this.authService.signIn(signInDto);
      // Set access token as HTTP-only cookie
      setTokenCookies(res, result.accessToken, result.refreshToken);

      return {
        statusCode: HttpStatus.OK,
        message: 'Login successful',
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      };
    } catch (error) {
      throw error;
    }
  }

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto, @Res({ passthrough: true }) res: Response) {
    try {
      const result = await this.authService.refreshAccessToken(refreshTokenDto);

      // Set new access token cookie
      setTokenCookies(res, result.accessToken, result.refreshToken);

      return {
        statusCode: HttpStatus.OK,
        message: 'Tokens refreshed successfully',
        accessToken: result.accessToken, // Also return in response for mobile apps
      };
    } catch (error) {
      console.error('Refresh token error:', error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Request() req,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      if (!req.user || !req.user.id) {
        throw new UnauthorizedException('User not authenticated');
      }

      await this.authService.logout(req.user.id);

      // Clear cookies
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');

      return {
        statusCode: HttpStatus.OK,
        message: 'Logout successful',
      };
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    try {
      return this.authService.forgotPassword(forgotPasswordDto);
    } catch (error) {
      console.error('Forgot password error:', error);
      throw error;
    }
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    try {
      return this.authService.resetPassword(resetPasswordDto);
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(@Request() req, @Body() changePasswordDto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.id, changePasswordDto);
  }

  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Query('code') code: string) {
    try {
      const result = await this.authService.verifyEmail(code);
      return {
        statusCode: HttpStatus.OK,
        ...result,
      };
    } catch (error) {
      throw error;
    }
  }

  @Post('resend-email-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerificationEmail(@Body() { email }: { email: string }) {
    try {
      const result = await this.authService.resendVerificationEmail(email);
      return {
        statusCode: HttpStatus.OK,
        ...result,
      };
    } catch (error) {
      throw error;
    }
  }
}