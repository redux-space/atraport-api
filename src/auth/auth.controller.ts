import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, RegisterDto, RevokeTokenDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from './entities/user.entity';
import { AuthGuard } from '@nestjs/passport';
import { AuthUser } from './auth.service';

@Controller('auth')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Public endpoints ──────────────────────────────────────────────────────

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Request() req: { user: AuthUser }) {
    return this.authService.login(req.user);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto, @Request() req: any) {
    // Decode the token to retrieve userId without full validation
    // (refresh tokens are opaque strings, userId must be supplied by client
    //  or embedded in a short-lived signed envelope)
    // For simplicity the client POSTs { refreshToken, userId } alternatively
    // we accept userId in the body as well.
    const { refreshToken, userId } = dto as any;
    return this.authService.refreshTokens(userId, refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: AuthUser,
    @Request() req: any,
  ): Promise<void> {
    const authHeader: string = req.headers?.authorization ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    await this.authService.logout(user.id, token);
  }

  @Post('revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.ADMIN)
  async revoke(@Body() dto: RevokeTokenDto): Promise<void> {
    await this.authService.revokeToken(dto.token);
  }

  // ─── API key management ────────────────────────────────────────────────────

  @Post('api-key')
  @HttpCode(HttpStatus.CREATED)
  generateApiKey(@CurrentUser() user: AuthUser) {
    return this.authService.generateApiKey(user.id);
  }

  @Delete('api-key')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeApiKey(@CurrentUser() user: AuthUser): Promise<void> {
    // Clear the stored api key hash
    await this.authService.generateApiKey(user.id); // re-generate and discard = effectively revokes old
  }

  // ─── Profile / status ──────────────────────────────────────────────────────

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Get('status')
  @Public()
  status() {
    return this.authService.getStatus();
  }
}
