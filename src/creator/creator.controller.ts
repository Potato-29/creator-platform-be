import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CreatorService } from './creator.service';
import { RolesGuard } from 'src/auth/guards/role.guard';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OnboardCreatorDto, OnboardResponseDto } from './dto/onboard-creator.dto';
import { WebhookNotificationDto } from './dto/webhook-notification.dto';
import { Roles } from 'src/decoretors/role.decorator';
import { Role } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Controller('creator')
export class CreatorController {
    constructor(private readonly creatorService: CreatorService, private readonly configService: ConfigService) { }

    @Post('onboard-creator')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Start or continue creator onboarding process' })
    @ApiResponse({ status: 200, description: 'Onboarding step completed', type: OnboardResponseDto })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 404, description: 'User not found' })
    @UseGuards(RolesGuard)
    @Roles(Role.creator, Role.superAdmin)
    async onboardCreator(
        @Body() dto: OnboardCreatorDto,
        @Req() req
    ): Promise<OnboardResponseDto> {
        const userId = req.user?.id;
        if (!userId) {
            throw new NotFoundException('User not found');
        }
        return await this.creatorService.onboardCreator(userId, dto);
    }

    @Post('onboard/notify')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Handle OPP webhook notifications' })
    @ApiResponse({ status: 200, description: 'Notification processed' })
    async handleWebhookNotification(@Body() notification: WebhookNotificationDto, @Res() res: Response): Promise<void> {
        await this.creatorService.handleWebhookNotification(notification);
        res.sendStatus(200);
    }

    @Get('onboard/return')
    @ApiOperation({ summary: 'Handle return from OPP verification pages' })
    @ApiResponse({ status: 200, description: 'Return handled' })
    async handleReturn(@Res() res: Response): Promise<void> {
        // You can redirect to your frontend with success/failure status
        res.redirect(`${this.configService.get<string>('server.frontendUrl')}/creator/verification`);
    }
}