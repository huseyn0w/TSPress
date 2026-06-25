import {
  type AdminContact,
  type AdminContactList,
  type UpdateContactInput,
  updateContactSchema,
} from '@cmstack-ts/config';
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CheckPolicies } from '../authz/check-policies.decorator';
import { PoliciesGuard } from '../authz/policies.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ContactService } from './contact.service';

/**
 * Admin contact inbox. Gated by the `Contact` subject (Administrators via
 * manage-all, and Editors who handle correspondence).
 */
@Controller('contact')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Get()
  @CheckPolicies((a) => a.can('read', 'Contact'))
  list(): Promise<AdminContactList> {
    return this.contact.list();
  }

  @Patch(':id')
  @CheckPolicies((a) => a.can('update', 'Contact'))
  setHandled(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateContactSchema)) body: UpdateContactInput,
  ): Promise<AdminContact> {
    return this.contact.setHandled(id, body.handled);
  }

  @Delete(':id')
  @HttpCode(204)
  @CheckPolicies((a) => a.can('delete', 'Contact'))
  async remove(@Param('id') id: string): Promise<void> {
    await this.contact.remove(id);
  }
}
