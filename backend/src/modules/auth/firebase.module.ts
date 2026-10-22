import {
  Logger,
  Module,
  ServiceUnavailableException,
  type Provider,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import type { AppConfig } from '../../config/configuration.js';

/** Phần Firebase Auth mà guard cần. Test thay bằng object giả. */
export interface IdTokenVerifier {
  verifyIdToken(idToken: string): Promise<DecodedIdToken>;
}

/** Tạo, xoá tài khoản Firebase khi Manager quản lý tài khoản (UC43). Cần service account. */
export interface FirebaseUserAdmin {
  /** Trả về uid; null khi dev chưa có service account (tài khoản chỉ tạo trong HMS). */
  createUser(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<string | null>;
  deleteUser(uid: string): Promise<void>;
}

export const ID_TOKEN_VERIFIER = Symbol('ID_TOKEN_VERIFIER');
export const FIREBASE_USER_ADMIN = Symbol('FIREBASE_USER_ADMIN');
const FIREBASE_APP = Symbol('FIREBASE_APP');

type Config = ConfigService<AppConfig, true>;

const providers: Provider[] = [
  {
    provide: FIREBASE_APP,
    inject: [ConfigService],
    useFactory: (config: Config): App | null => {
      const { projectId, clientEmail, privateKey } = config.get('firebase', {
        infer: true,
      });
      if (!projectId) {
        Logger.warn(
          'Chưa có FIREBASE_PROJECT_ID: mọi Bearer token bị từ chối, dùng header x-dev-role khi dev',
          'Firebase',
        );
        return null;
      }
      // Kiểm tra ID token chỉ cần projectId; service account dùng cho thao tác quản trị (UC43).
      return initializeApp({
        projectId,
        ...(clientEmail && privateKey
          ? { credential: cert({ projectId, clientEmail, privateKey }) }
          : {}),
      });
    },
  },
  {
    provide: ID_TOKEN_VERIFIER,
    inject: [FIREBASE_APP],
    useFactory: (app: App | null): IdTokenVerifier =>
      app
        ? getAuth(app)
        : {
            verifyIdToken: () =>
              Promise.reject(new Error('Firebase chưa được cấu hình')),
          },
  },
  {
    provide: FIREBASE_USER_ADMIN,
    inject: [FIREBASE_APP, ConfigService],
    useFactory: (app: App | null, config: Config): FirebaseUserAdmin => {
      const { clientEmail, privateKey } = config.get('firebase', {
        infer: true,
      });
      if (app && clientEmail && privateKey) {
        const auth = getAuth(app);
        return {
          createUser: async (input) =>
            (await auth.createUser({ ...input, emailVerified: true })).uid,
          deleteUser: (uid) => auth.deleteUser(uid),
        };
      }
      const isProduction = config.get('env', { infer: true }) === 'production';
      return {
        createUser: () => {
          if (isProduction) {
            throw new ServiceUnavailableException(
              'Chưa cấu hình service account Firebase',
            );
          }
          return Promise.resolve(null);
        },
        deleteUser: () => Promise.resolve(),
      };
    },
  },
];

@Module({
  providers,
  exports: [ID_TOKEN_VERIFIER, FIREBASE_USER_ADMIN],
})
export class FirebaseModule {}
