import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
  Logger,
  Param,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { UpdateProfileDto } from 'src/auth/dto/update-profile.dto';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  getProfile(@Request() req) {
    return this.usersService.findOne(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  getUserById(@Param('id') userId: string) {
    return this.usersService.findOne(userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('notification-token')
  async updateToken(@Request() req, @Body() body: any) {
    this.logger.log(
      `[DEBUG] Rota updateToken chamada pelo user: ${req.user.userId}`,
    );
    this.logger.log(
      `[DEBUG] Body recebido no Controller: ${JSON.stringify(body)}`,
    );

    const token = body.token;

    this.logger.log(`[DEBUG] Token extraído: ${token} (Tipo: ${typeof token})`);

    return this.usersService.update(req.user.userId, {
      notificationToken: token,
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('profile')
  updateProfile(@Request() req, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.userId, dto);
  }
}
