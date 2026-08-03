import {
  BatteryLow,
  ChevronDown,
  Compass,
  Download,
  Gauge,
  HeartPulse,
  MoonStar,
  Orbit,
  Plus,
  Radio,
  RefreshCw,
  Route,
  Settings2,
  Star,
  Upload,
  X,
  createIcons,
} from "lucide";
import { createApp } from "./app/controller.mjs";

const icons = {
  BatteryLow,
  ChevronDown,
  Compass,
  Download,
  Gauge,
  HeartPulse,
  MoonStar,
  Orbit,
  Plus,
  Radio,
  RefreshCw,
  Route,
  Settings2,
  Star,
  Upload,
  X,
};

globalThis.lucide = {
  createIcons(options = {}) {
    const { root: _root, ...attributes } = options;
    return createIcons({ ...attributes, icons });
  },
};

createApp();
