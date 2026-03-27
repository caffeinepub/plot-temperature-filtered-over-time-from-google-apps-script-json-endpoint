import { ProfilePage } from "@/pages/ProfilePage";
import { TSICLoggersPage } from "@/pages/TSICLoggersPage";
import { TemperatureDashboardPage } from "@/pages/TemperatureDashboardPage";
import type { ComponentType } from "react";

export interface LogSystemPage {
  id: string;
  displayName: string;
  subtitle: string;
  component: ComponentType;
}

export const logSystemPages: LogSystemPage[] = [
  {
    id: "tsic-loggers",
    displayName: "TSIC Loggers",
    subtitle:
      "Select a logger ID to view 72 sensor data streams - sensor data older then 19 days is deleted",
    component: TSICLoggersPage,
  },
  {
    id: "conceptmachine",
    displayName: "Conceptmachine",
    subtitle:
      "data logging • Updated every 10-20 min • Data older than 19 days is not retained",
    component: TemperatureDashboardPage,
  },
  {
    id: "profile",
    displayName: "Profile",
    subtitle: "Manage your account and settings",
    component: ProfilePage,
  },
];
