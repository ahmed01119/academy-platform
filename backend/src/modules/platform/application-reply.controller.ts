import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApplicationReplyTokenSchema,
  SubmitAcademyApplicationReplySchema,
  type AcademyApplicationReplyView,
} from '@academy/shared';
import { Public } from '../auth/guards/public.decorator';
import { CsrfGuard } from '../auth/guards/csrf.guard';
import { ApplicationReplyService } from './application-reply.service';

/**
 * Public endpoints of the "answer the requested details" page (`/application-reply?token=...`). The signed token from
 * the e-mail is the credential; the applicant's account is still pending and cannot sign in.
 */
@Controller('academy-applications/reply')
export class ApplicationReplyController {
  constructor(@Inject(ApplicationReplyService) private readonly replies: ApplicationReplyService) {}

  /** The request to answer. 400 TOKEN_INVALID / TOKEN_EXPIRED when the link is not or no longer usable. */
  @Public()
  @Get()
  async view(@Query('token') token: unknown): Promise<AcademyApplicationReplyView> {
    return this.replies.getView(ApplicationReplyTokenSchema.parse(token));
  }

  /** Sends the answer; the application goes back to review and the platform admins are notified. */
  @Public()
  @UseGuards(CsrfGuard)
  @Post()
  @HttpCode(HttpStatus.OK)
  async submit(@Body() body: unknown): Promise<{ success: true }> {
    return this.replies.submit(SubmitAcademyApplicationReplySchema.parse(body));
  }
}
