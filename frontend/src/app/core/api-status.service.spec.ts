import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../environments/environment';
import { ApiStatusService } from './api-status.service';

describe('ApiStatusService', () => {
  let service: ApiStatusService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApiStatusService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('calls the health endpoint on the configured API URL', () => {
    service.check();

    expect(service.status()).toBe('checking');
    http.expectOne(`${environment.apiUrl}/actuator/health`).flush({ status: 'UP' });
    expect(service.status()).toBe('up');
  });

  it('reports down when the API is not healthy', () => {
    service.check();

    http.expectOne(`${environment.apiUrl}/actuator/health`).flush({ status: 'DOWN' });
    expect(service.status()).toBe('down');
  });

  it('reports down when the request fails', () => {
    service.check();

    http
      .expectOne(`${environment.apiUrl}/actuator/health`)
      .flush(null, { status: 0, statusText: 'Unknown Error' });
    expect(service.status()).toBe('down');
  });
});
