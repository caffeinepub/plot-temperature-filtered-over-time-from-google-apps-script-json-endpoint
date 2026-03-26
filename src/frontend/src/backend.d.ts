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
    getAdvancedChartConfigForId(id: bigint): Promise<string>;
    getAllAdmins(): Promise<Array<AdminInfo>>;
    getAllLoggerLabels(): Promise<Array<[bigint, string]>>;
    getAllSensorLabelsForId(loggerId: bigint): Promise<Array<[bigint, string]>>;
    getBackupsForId(id: bigint): Promise<string>;
    getCallerUserProfile(): Promise<UserProfileInfo | null>;
    getCallerUserRole(): Promise<UserRole>;
    getGoogleSheetsDownloadLink(): Promise<string>;
    getGrantedAdmins(): Promise<Array<Principal>>;
    getSensorGroupsForId(id: bigint): Promise<string>;
    getUserProfile(user: Principal): Promise<UserProfileInfo>;
    getUserRole(): Promise<UserRole | null>;
    grantAdminRole(target: Principal): Promise<boolean>;
    hasProfile(): Promise<boolean>;
    isCallerAdmin(): Promise<boolean>;
    isConceptMachineVisible(): Promise<boolean>;
    resetSensorLabelsForId(loggerId: bigint): Promise<void>;
    saveAdvancedChartConfigForId(id: bigint, json: string): Promise<void>;
    saveBackupsForId(id: bigint, json: string): Promise<void>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    saveSensorGroupsForId(id: bigint, json: string): Promise<void>;
    setConceptMachineVisible(visible: boolean): Promise<void>;
    setLoggerIdLabel(id: bigint, loggerLabel: string): Promise<void>;
    setSensorLabel(loggerId: bigint, sensorNum: bigint, sensorLabel: string): Promise<void>;
}
