import { createContext } from 'react';
import type { IframeKeepAlivePoolValue } from '../types.js';

export const IframeKeepAliveContext = createContext<IframeKeepAlivePoolValue | null>(null);
