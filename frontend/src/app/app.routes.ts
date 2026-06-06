import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component'; // <-- Assure-toi que le chemin vers ton register est bien celui-là
import { DashboardComponent } from './dashboard/dashboard.component';
import { authGuard } from './core/guards/auth-functional.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'register',
    component: RegisterComponent, // <-- On déclare enfin la route de l'inscription !
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard(['declarant', 'douanier'])],
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