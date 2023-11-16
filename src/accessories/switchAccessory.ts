import {
  Service,
  PlatformAccessory,
  CharacteristicValue,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  API,
} from 'homebridge';
import rfxcom from 'rfxcom';
import { Device } from '../device';

import { RFXCOMSomfy } from '../platform';
export class SwitchDevice extends Device {
  constructor(
    public readonly api: API,
    public readonly id: string,
    public readonly name: string,
    public readonly type: string,
    public readonly subtype: string,
    public readonly forceOffAtStartup: boolean,
  ) {
    super(api, 'SwitchDevice', id, name);
  }
}

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class SwitchAccessory {
  private service: Service;

  private switch: typeof rfxcom.Rfy;

  private state: CharacteristicValue = false;

  constructor(
    private readonly platform: RFXCOMSomfy,
    private readonly accessory: PlatformAccessory,
  ) {
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'loick111')
      .setCharacteristic(this.platform.Characteristic.Model, 'Switch')
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        this.accessory.UUID,
      );

    this.service =
      this.accessory.getService(this.platform.Service.Switch) ||
      this.accessory.addService(this.platform.Service.Switch);

    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      this.accessory.displayName,
    );
    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .on('get', this.getValue.bind(this))
      .on('set', this.setValue.bind(this));

    // setup RFXCOM protocol
    if (!(rfxcom[this.accessory.context.device.type] instanceof Function)) {
      throw new Error(
        `Device type '${this.accessory.context.device.type}' is unknown`,
      );
    }
    this.switch = new rfxcom[this.accessory.context.device.type](
      this.platform.rfxcom,
      this.accessory.context.device.subtype,
    );

    // make sure that accessory is off by default is forceOffAtStartup is true
    this.platform.rfxcom.on('ready', () => {
      if (this.accessory.context.device.forceOffAtStartup) {
        this.switch.switchOff(this.accessory.context.device.id);
      }
    });
  }

  getValue(callback: CharacteristicGetCallback) {
    this.platform.log.debug('Triggered GET CurrentPosition');
    callback(null, this.state);
  }

  setValue(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.platform.log.debug('Triggered SET TargetPosition: ' + value);

    if (value) {
      this.switch.switchOn(this.accessory.context.device.id);
    } else {
      this.switch.switchOff(this.accessory.context.device.id);
    }

    this.state = value;
    callback();
  }
}
