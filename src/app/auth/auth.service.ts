import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, from, Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { User } from './user.model';
import { Storage } from '@capacitor/storage';

export interface AuthResponseData {
  kind: string;
  idToken: string;
  email: string;
  refreshToken: string;
  localId: string;
  expiresIn: string;
  registered?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private _user = new BehaviorSubject<User>(null);

  get userIsAuthenticated(): Observable<boolean> {
    return this._user.asObservable().pipe(
      map(user => {
        if (user) {
          return !!user.token;
        } else {
          return false;
        }
      })
    );
  }

  get userId(): string {
    return this._user.getValue().id;
  }

  get userId$(): Observable<string> {
    return this._user.asObservable().pipe(
      map(user => {
        if (user) {
          return user.id;
        } else {
          return null;
        }
      })
    );
  }

  constructor(private http: HttpClient) {
  }

  autoLogin(): Observable<any> {
    return from(Storage.get({key: 'authData'}))
      .pipe(
        map(e => {
          if (!e || !e.value) {
            return null;
          }

          const parsedData = JSON.parse(e.value) as {
            userId: string,
            token: string,
            tokenExpirationDate: string,
            email: string
          };

          const expirationTime = new Date(parsedData.tokenExpirationDate);
          if (expirationTime <= new Date()) {
            return null;
          }

          const user = new User(
            parsedData.userId,
            parsedData.email,
            parsedData.token,
            expirationTime
          );

          return user;
        }),
        // set state
        tap(user => {
          if (user) {
            this._user.next(user);
          }
        }),
        // return statement
        map(user => {
          return !!user;
        })
      )
  }

  signup(email: string, password: string) {
    return this.http
      .post<AuthResponseData>(
        `https://www.googleapis.com/identitytoolkit/v3/relyingparty/signupNewUser?key=${
          environment.firebaseAPIKey
        }`,
        { email: email, password: password, returnSecureToken: true }
      )
      .pipe(
        tap(this.setUserData.bind(this))
      );
  }

  login(email: string, password: string) {
    return this.http
      .post<AuthResponseData>(
        `https://www.googleapis.com/identitytoolkit/v3/relyingparty/verifyPassword?key=${
          environment.firebaseAPIKey
        }`,
        { email: email, password: password, returnSecureToken: true }
      )
      .pipe(tap(this.setUserData.bind(this)));
  }

  logout() {
    this._user.next(null);
    Storage.remove({key: 'authData'});
  }

  private setUserData(userData: AuthResponseData) {
    const expirationTime = new Date(
      new Date().getTime() + +userData.expiresIn * 1000
    );
    this._user.next(
      new User(
        userData.localId,
        userData.email,
        userData.idToken,
        expirationTime
      )
    );

    this.storeAuthData(userData.localId, userData.idToken, expirationTime.toISOString(), userData.email);
  }

  private storeAuthData(
    userId: string, 
    token: string, 
    tokenExpirationDate: string,
    email: string
    ) {
    
    const data = {
      userId: userId,
      token: token,
      tokenExpirationDate: tokenExpirationDate,
      email: email
    };

    Storage.set(
      {key: 'authData', value: JSON.stringify(data)}
    )
  }

}
