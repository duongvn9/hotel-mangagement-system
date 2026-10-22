import { Logger, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import type { AppConfig } from '../../config/configuration.js';

/** Phần Firebase Auth mà guard cần. Test thay bằng object giả. */
export interface IdTokenVerifier {
  verifyIdToken(idToken: string): Promise<DecodedIdToken>;
}

export const ID_TOKEN_VERIFIER = Symbol('ID_TOKEN_VERIFIER');

export const firebaseVerifierProvider: Provider = {
  provide: ID_TOKEN_VERIFIER,
  inject: [ConfigService],
  useFactory: (config: ConfigService<AppConfig, true>): IdTokenVerifier => {
    const { projectId, clientEmail, privateKey } = config.get('firebase', {
      infer: true,
    });
    if (!projectId) {
      Logger.warn(
        'Chưa có FIREBASE_PROJECT_ID: mọi Bearer token bị từ chối, dùng header x-dev-role khi dev',
        'Firebase',
      );
      return {
        verifyIdToken: () =>
          Promise.reject(new Error('Firebase chưa được cấu hình')),
      };
    }
    // Kiểm tra ID token chỉ cần projectId; service account dùng cho thao tác quản trị (UC43).
    const app = initializeApp({
      projectId,
      ...(clientEmail && privateKey
        ? { credential: cert({ projectId, clientEmail, privateKey }) }
        : {}),
    });
    return getAuth(app);
  },
};
