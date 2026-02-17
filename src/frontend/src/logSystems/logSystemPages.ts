import { ComponentType } from 'react';
import { TemperatureDashboardPage } from '@/pages/TemperatureDashboardPage';
import { TSICLogger1Page } from '@/pages/TSICLogger1Page';
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
    id: 'tsic-logger-1',
    displayName: 'TSIC logger 1',
    subtitle: 'to do',
    component: TSICLogger1Page,
  },
  {
    id: 'profile',
    displayName: 'Profile',
    subtitle: 'Manage your account and settings',
    component: ProfilePage,
  },
];
