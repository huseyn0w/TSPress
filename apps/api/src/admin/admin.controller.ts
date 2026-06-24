import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../authz/check-policies.decorator';
import { PoliciesGuard } from '../authz/policies.guard';
import { type AdminOverview, AdminService } from './admin.service';

/**
 * Demonstrates role-gated access: only callers whose ability allows
 * `read Admin` (administrators, editors) may see the overview. Thin controller —
 * the counts come from {@link AdminService}.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  @CheckPolicies((ability) => ability.can('read', 'Admin'))
  overview(): Promise<AdminOverview> {
    return this.admin.overview();
  }
}
