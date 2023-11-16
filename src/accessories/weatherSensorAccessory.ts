import { API, PlatformAccessory } from 'homebridge';
import { Device } from '../device';

import { RFXCOMSomfy } from '../platform';

export class WeatherSensorDevice extends Device {
  constructor(
    public readonly api: API,
    public readonly id: string,
    public readonly name: string,
    public readonly type: string,
  ) {
    super(api, 'WeatherSensorDevice', id, name);
  }
}

export class WeatherSensorEvent {
  constructor(
    public readonly battery: number,
    public readonly temperature: number,
    public readonly humidity: number,
  ) {}
}

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class WeatherSensorAccessory {
  constructor(
    private readonly platform: RFXCOMSomfy,
    private readonly accessory: PlatformAccessory,
    private readonly event: WeatherSensorEvent,
  ) {
    // set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'loick111')
      .setCharacteristic(this.platform.Characteristic.Model, 'WeatherSensor')
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        this.accessory.UUID,
      );

    // battery
    const battery = this.event.battery;
    if (battery !== undefined) {
      const batteryService =
        this.accessory.getService(this.platform.Service.Battery) ||
        this.accessory.addService(this.platform.Service.Battery);

      batteryService.setCharacteristic(
        this.platform.Characteristic.Name,
        this.accessory.displayName,
      );
      batteryService.setCharacteristic(
        this.platform.Characteristic.BatteryLevel,
        battery,
      );
    }

    // temperature
    const temperature = this.event.temperature;
    if (temperature !== undefined) {
      const temperatureService =
        this.accessory.getService(this.platform.Service.TemperatureSensor) ||
        this.accessory.addService(this.platform.Service.TemperatureSensor);

      temperatureService.setCharacteristic(
        this.platform.Characteristic.Name,
        this.accessory.displayName,
      );
      temperatureService.setCharacteristic(
        this.platform.Characteristic.CurrentTemperature,
        temperature,
      );
    }

    // humidity
    const humidity = this.event.humidity;
    if (humidity !== undefined) {
      const humidityService =
        this.accessory.getService(this.platform.Service.HumiditySensor) ||
        this.accessory.addService(this.platform.Service.HumiditySensor);

      humidityService.setCharacteristic(
        this.platform.Characteristic.Name,
        this.accessory.displayName,
      );
      humidityService.setCharacteristic(
        this.platform.Characteristic.CurrentRelativeHumidity,
        humidity,
      );
    }
  }
}
