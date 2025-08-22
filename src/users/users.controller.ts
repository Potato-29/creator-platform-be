import { Controller, Get, Post, Body, Param, NotFoundException, Req, UseGuards, Put, HttpCode, HttpStatus, ValidationPipe, Query, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto, UserProfileResponseDto } from './dto/update-user.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Roles } from 'src/decoretors/role.decorator';
import { Role } from '@prisma/client';
import { RolesGuard } from 'src/auth/guards/role.guard';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { DeactivateUserDto } from './dto/deactivate-user.dto';
import { UserSearchResponseDto } from './dto/user-search-response.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {  }
  @Get('profile')
  getProfile(@Req() req) {
    return req.user;
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user profile' })
  @ApiParam({ name: 'id', description: 'User ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'User profile updated successfully',
    type: UserProfileResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 403, description: 'Can only update own profile' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'Username or email already exists' })
  async updateUserProfile(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: any,
  ): Promise<UserProfileResponseDto> {
    // Ensure user can only update their own profile
    const currentUserId = req.user?.id;
    if (currentUserId !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }
    return this.usersService.updateUserProfile(id, updateUserDto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.superAdmin)
  getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Get('current-user')
  async currentUser(@Req() req) {
    const userId = req.user?.id;
    if (!userId) {
      throw new NotFoundException('User not found');
    }
    return await this.usersService.currentUser(userId);
  }

  @Post('deactivate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate user account' })
  @ApiResponse({
    status: 200,
    description: 'Account deactivated successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Account already deactivated' })
  @ApiResponse({ status: 401, description: 'Invalid password or unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deactivateAccount(
    @Body(ValidationPipe) deactivateUserDto: DeactivateUserDto,
    @Req() req: any,
  ): Promise<{ message: string }> {
    const userId = req.user?.id;
    
    return this.usersService.deactivateUser(userId, deactivateUserDto);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search users by userName' })
  @ApiQuery({
    name: 'userName',
    description: 'Username to search for (partial matches supported)',
    example: 'john',
  })
  @ApiResponse({
    status: 200,
    description: 'Users found successfully',
    type: [UserSearchResponseDto],
  })
  @ApiResponse({ status: 400, description: 'Invalid search query' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async searchUsers(
    @Query('userName') userName: string,
  ): Promise<UserSearchResponseDto[]> {
    // Manual validation since we're using query params
    if (!userName || userName.trim().length === 0) {
      throw new Error('Username query parameter is required');
    }

    if (userName.length > 50) {
      throw new Error('Username query is too long (max 50 characters)');
    }

    const trimmedUsername = userName.trim();
    
    return this.usersService.searchUsersByUsername(trimmedUsername);
  }

  @Get('creators/list')
  @UseGuards(RolesGuard)
  @Roles(Role.superAdmin, Role.creator)
  @ApiOperation({ summary: 'Get all creators' })
  @ApiResponse({
    status: 200,
    description: 'Creators retrieved successfully',
  })
  @ApiResponse({ status: 403, description: 'Access denied - Admin or Creator role required' })
  getCreators() {
    return this.usersService.getUsersByRole(Role.creator);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ 
    name: 'id', 
    description: 'User ID (UUID)',
    type: 'string',
    format: 'uuid'
  })
  @ApiResponse({
    status: 200,
    description: 'User retrieved successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid UUID format' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }
}
