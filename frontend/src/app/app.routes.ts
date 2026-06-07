import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { DouanierDashboardComponent } from './douanier-dashboard/douanier-dashboard.component';
import { authGuard } from './core/guards/auth-functional.guard';
import { DouanierGuard } from './core/guards/douanier.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'register',
    component: RegisterComponent,
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard(['declarant', 'douanier'])],
  },
  {
    path: 'douanier-dashboard',
    component: DouanierDashboardComponent,
    canActivate: [DouanierGuard],
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'login',
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];