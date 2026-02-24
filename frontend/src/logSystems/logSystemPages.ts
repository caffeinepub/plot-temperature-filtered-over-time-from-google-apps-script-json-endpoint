import { ComponentType } from 'react';
import { TemperatureDashboardPage } from '@/pages/TemperatureDashboardPage';
import { TSICLoggersPage } from '@/pages/TSICLoggersPage';
import { ProfilePage } from '@/pages/ProfilePage';

export interface LogSystemPage {
  id: string;
  displayName: string;
  subtitle: string;
  component: ComponentType;
}

export const logSystemPages: LogSystemPage[] = [
  {
    id: 'conceptmachine',
    displayName: 'Conceptmachine',
    subtitle: 'data logging • Updated every 10-20 min • Data older than 19 days is not retained',
    component: TemperatureDashboardPage,
  },
  {
    id: 'tsic-loggers',
    displayName: 'TSIC Loggers',
    subtitle: 'Select a logger ID to view 72 sensor data streams',
    component: TSICLoggersPage,
  },
  {
    id: 'profile',
    displayName: 'Profile',
    subtitle: 'Manage your account and settings',
    component: ProfilePage,
  },
];
