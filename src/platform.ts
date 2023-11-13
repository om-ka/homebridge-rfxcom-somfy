import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic,
} from 'homebridge';
import rfxcom from 'rfxcom';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { RFYAccessory, RFYDevice } from './accessories/rfyAccessory';
import {
  WeatherSensorAccessory,
  WeatherSensorDevice,
  WeatherSensorEvent,
} from './accessories/weatherSensorAccessory';
import { Device } from './device';
import { SwitchDevice, SwitchAccessory } from './accessories/switchAccessory';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class RFXCOMSomfy implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic =
    this.api.hap.Characteristic;

  // platform devices
  public devices: Device[] = [];

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  // rfxcom
  public readonly rfxcom: typeof rfxcom.RfxCom;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    // load configuration file
    this.loadConfig();

    // rfxcom init
    this.rfxcom = new rfxcom.RfxCom(this.config.tty, {
      debug: this.config.debug,
    });

    this.rfxcom.on('disconnect', () =>
      this.log.error('ERROR: RFXtrx disconnect'),
    );
    this.rfxcom.on('connectfailed', () =>
      this.log.error('ERROR: RFXtrx connect fail'),
    );

    this.rfxcom.initialise(() => {
      this.log.info('RFXtrx initialized!');
    });

    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
      this.cleanDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  private loadConfig() {
    // Load RFY
    this.devices.push(
      ...(this.config.devices.rfy?.map(
        (device) =>
          new RFYDevice(
            this.api,
            device.deviceId,
            device.name,
            device.reversed,
            device.openDurationSeconds,
            device.closeDurationSeconds,
            device.forceCloseAtStartup,
          ),
      ) || []),
    );

    // Load WeatherSensors
    this.devices.push(
      ...(this.config.devices.weatherSensors?.map(
        (device) =>
          new WeatherSensorDevice(
            this.api,
            device.id,
            device.name,
            device.type,
          ),
      ) || []),
    );

    // Load Switch
    this.devices.push(
      ...(this.config.devices.switch?.map(
        (device) =>
          new SwitchDevice(
            this.api,
            device.id,
            device.name,
            device.type,
            device.subtype,
            device.forceOffAtStartup,
          ),
      ) || []),
    );
  }

  private cleanDevices() {
    const toClean = this.accessories.filter(
      (a) => this.devices.find((d) => d.uuid === a.UUID) === undefined,
    );

    this.log.info(
      'Cleaning devices:',
      toClean.map((d) => ({
        name: d.context.device.name,
        kind: d.context.device.kind,
      })),
    );

    this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, toClean);
  }

  private discoverDevices() {
    this.discoverRFYDevices();
    this.discoverWeatherSensorDevices();
    this.discoverSwitchDevices();
  }

  /**
   * Register RFY Somfy devices
   */
  private discoverRFYDevices() {
    // loop over the discovered devices and register each one if it has not already been registered
    for (const device of this.devices.filter((d) => d instanceof RFYDevice)) {
      const existingAccessory = this.accessories.find(
        (accessory) => accessory.UUID === device.uuid,
      );

      if (existingAccessory) {
        // the accessory already exists
        existingAccessory.context.device = device;
        new RFYAccessory(this, existingAccessory);
        this.api.updatePlatformAccessories([existingAccessory]);
      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', device.name);
        const accessory = new this.api.platformAccessory(
          device.name,
          device.uuid,
        );
        accessory.context.device = device;
        new RFYAccessory(this, accessory);

        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          accessory,
        ]);
        this.accessories.push(accessory);
      }
    }
  }

  /**
   * Register weather sensors
   */
  private discoverWeatherSensorDevices() {
    // listen on sensor events
    const addHandler = (type) =>
      this.rfxcom.on(type, (e) => handleEvent(type, e));
    addHandler('temperature1');
    addHandler('humidity1');
    addHandler('temperaturehumidity1');
    addHandler('thermostat1');
    addHandler('thermostat3');
    addHandler('bbq1');
    addHandler('temperaturerain1');
    addHandler('temphumbaro1');
    addHandler('wind1');
    addHandler('uv1');

    const handleEvent = (type, event) => {
      if (this.config.discover) {
        this.log.info(`WeatherSensor event '${type}' received:\n`, event);
      }

      // handle only configured devices
      const device = this.devices
        .filter((d) => d instanceof WeatherSensorDevice)
        .find(
          (d) => d.id === event.id && (d as WeatherSensorDevice).type === type,
        );

      if (device !== undefined) {
        handleDevice(
          device,
          new WeatherSensorEvent(
            event.batteryLevel,
            event.temperature,
            event.humidity,
          ),
        );
      }
    };

    const handleDevice = (device, event) => {
      const existingAccessory = this.accessories.find(
        (accessory) => accessory.UUID === device.uuid,
      );

      if (existingAccessory) {
        // the accessory already exists
        existingAccessory.context.device = device;
        new WeatherSensorAccessory(this, existingAccessory, event);
        this.api.updatePlatformAccessories([existingAccessory]);
      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', device.name);

        const accessory = new this.api.platformAccessory(
          device.name,
          device.uuid,
        );
        accessory.context.device = device;
        new WeatherSensorAccessory(this, accessory, event);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          accessory,
        ]);
        this.accessories.push(accessory);
      }
    };
  }

  /**
   * Register Switch devices
   */
  private discoverSwitchDevices() {
    // loop over the discovered devices and register each one if it has not already been registered
    for (const device of this.devices.filter(
      (d) => d instanceof SwitchDevice,
    )) {
      const existingAccessory = this.accessories.find(
        (accessory) => accessory.UUID === device.uuid,
      );

      if (existingAccessory) {
        // the accessory already exists
        existingAccessory.context.device = device;
        new SwitchAccessory(this, existingAccessory);
        this.api.updatePlatformAccessories([existingAccessory]);
      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', device.name);
        const accessory = new this.api.platformAccessory(
          device.name,
          device.uuid,
        );
        accessory.context.device = device;
        new SwitchAccessory(this, accessory);

        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          accessory,
        ]);
        this.accessories.push(accessory);
      }
    }
  }
}
