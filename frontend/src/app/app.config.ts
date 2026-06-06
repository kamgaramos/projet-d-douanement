import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HTTP_INTERCEPTORS } from '@angular/common/http';

import { routes } from './app.routes';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    
    // Active HttpClient (standalone) et intègre le support des intercepteurs basés sur les classes (DI)
    provideHttpClient(withInterceptorsFromDi()),
    
    // Enregistre l'intercepteur d'authentification pour intercepter et ajouter le token JWT à tes requêtes vers l'API
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
  ],
};