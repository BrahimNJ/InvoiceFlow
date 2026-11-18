import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { Role } from '../core/auth/auth.models';
import { Page } from '../core/http/page';
import { AdminAction, AdminUser, AdminUserQuery, PlatformStats } from './admin.models';

export const ADMIN_API = `${environment.apiUrl}/api/admin`;

/** Back-office calls. The API answers 403 unless the signed-in user is an active admin. */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);

  users({ search, page = 0, size = 20 }: AdminUserQuery = {}): Observable<Page<AdminUser>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (search?.trim()) {
      params = params.set('search', search.trim());
    }
    return this.http.get<Page<AdminUser>>(`${ADMIN_API}/users`, { params });
  }

  changeRole(userId: number, role: Role): Observable<AdminUser> {
    return this.http.put<AdminUser>(`${ADMIN_API}/users/${userId}/role`, { role });
  }

  suspend(userId: number): Observable<AdminUser> {
    return this.http.put<AdminUser>(`${ADMIN_API}/users/${userId}/suspension`, null);
  }

  reactivate(userId: number): Observable<AdminUser> {
    return this.http.delete<AdminUser>(`${ADMIN_API}/users/${userId}/suspension`);
  }

  stats(): Observable<PlatformStats> {
    return this.http.get<PlatformStats>(`${ADMIN_API}/stats`);
  }

  audit(page = 0, size = 20): Observable<Page<AdminAction>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<Page<AdminAction>>(`${ADMIN_API}/audit`, { params });
  }
}
