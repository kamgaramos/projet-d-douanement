import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { DouanierDashboardComponent } from './douanier-dashboard/douanier-dashboard.component';
import { DeclarationDetailsComponent } from './declaration-details/declaration-details.component';
import { TestChatComponent } from './test-chat/test-chat.component';
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
    canActivate: [authGuard(['declarant', 'douanier', 'transitaire'])],
  },
  {
    path: 'douanier-dashboard',
    component: DouanierDashboardComponent,
    canActivate: [DouanierGuard],
  },
  {
    path: 'declaration-details/:id',
    component: DeclarationDetailsComponent,
    canActivate: [authGuard(['declarant', 'douanier', 'transitaire', 'admin'])],
  },
  {
    path: 'test-chat',
    component: TestChatComponent,
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