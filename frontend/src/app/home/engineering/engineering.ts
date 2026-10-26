import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon } from '../../shared/icon/icon';

const SOURCE = 'https://github.com/BrahimNJ/InvoiceFlow/blob/main/';

interface Practice {
  title: string;
  text: string;
  /** Repository path of the code that backs the claim. */
  path: string;
}

/** The parts a screenshot cannot show, each linked to the code that implements it. */
@Component({
  selector: 'app-engineering',
  imports: [Icon, RouterLink],
  templateUrl: './engineering.html',
  styleUrl: './engineering.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Engineering {
  protected readonly source = SOURCE;
  protected readonly practices: Practice[] = [
    {
      title: 'Gap-free numbering, under concurrency',
      text:
        'French law forbids holes in the invoice sequence. A counter row per owner and year is incremented inside the ' +
        'issuing transaction: concurrent issues wait on its lock, a rollback gives the number back.',
      path: 'backend/src/main/java/com/naji/backend/invoice/InvoiceNumberGenerator.java',
    },
    {
      title: 'Money is never a float',
      text:
        'BigDecimal on the server, integer cents in the browser. Each line is rounded half up, VAT is computed once per ' +
        'rate, so the live preview and the issued invoice cannot disagree.',
      path: 'frontend/src/app/invoices/invoice-calc.ts',
    },
    {
      title: 'Sessions that detect token theft',
      text:
        'Fifteen-minute JWT access tokens kept in memory, refresh tokens in an HttpOnly cookie rotated on every use. ' +
        'Replaying an old refresh token revokes every session of the account.',
      path: 'backend/src/main/java/com/naji/backend/auth/RefreshTokenService.java',
    },
    {
      title: 'Tenant isolation by default',
      text:
        'Every query is scoped to its owner. Another account’s invoice answers 404, exactly like a missing one, so ids ' +
        'reveal nothing. Each module has an ownership integration test.',
      path: 'backend/src/test/java/com/naji/backend/customer/CustomerOwnershipIntegrationTest.java',
    },
    {
      title: 'Errors with a contract',
      text:
        'Validation, conflicts and business-rule failures come back as RFC 9457 problem details. Issuing an invoice that ' +
        'misses a mandatory mention returns 422 with the list of what is missing.',
      path: 'backend/src/main/java/com/naji/backend/common/exception/GlobalExceptionHandler.java',
    },
    {
      title: 'Deploys that prove themselves',
      text:
        'The deploy is pinned to the commit CI just tested, then waits until the running API reports that exact commit ' +
        'and passes a smoke test. A silently stale production gets caught.',
      path: '.github/workflows/deploy-backend.yml',
    },
  ];
}
