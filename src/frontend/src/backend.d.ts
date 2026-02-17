import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface UserProfileInfo {
    principal: Principal;
    name: string;
    isAdmin: boolean;
}
export interface AdminInfo {
    principal: Principal;
    name: string;
}
export interface UserProfile {
    name: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    getAllAdmins(): Promise<Array<AdminInfo>>;
    getCallerUserProfile(): Promise<UserProfileInfo | null>;
    getCallerUserRole(): Promise<UserRole>;
    getGoogleSheetsDownloadLink(): Promise<string>;
    getUserProfile(user: Principal): Promise<UserProfileInfo>;
    getUserRole(): Promise<UserRole | null>;
    hasProfile(): Promise<boolean>;
    isCallerAdmin(): Promise<boolean>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
}
