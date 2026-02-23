import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
  Logger,
  Param,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { UpdateProfileDto } from 'src/auth/dto/update-profile.dto';
import { UserRole } from './entities/user.entity';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  getProfile(@Request() req: any) {
    return this.usersService.findOne(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('admin/list')
  async adminList(@Request() req: any, @Query('skip') skip = 0, @Query('take') take = 50) {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Apenas administradores podem listar usuários.');
    }
    return this.usersService.findAllForAdmin(Number(skip), Number(take));
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/coins')
  async adminAddCoins(@Request() req: any, @Param('id') id: string, @Body() body: { amount?: number }) {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Apenas administradores podem ajustar moedas.');
    }
    return this.usersService.addCoins(id, body?.amount ?? 1);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/ban')
  async adminBan(@Request() req: any, @Param('id') id: string, @Body() body: { banned?: boolean }) {
    if (req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Apenas administradores podem banir usuários.');
    }
    return this.usersService.setBanned(id, body?.banned ?? true);
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
