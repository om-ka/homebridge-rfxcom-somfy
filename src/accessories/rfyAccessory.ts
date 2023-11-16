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
export class RFYDevice extends Device {
  constructor(
    public readonly api: API,
    public readonly id: string,
    public readonly name: string,
    public readonly reversed: boolean,
    public readonly openDurationSeconds: number,
    public readonly closeDurationSeconds: number,
    public readonly forceCloseAtStartup: boolean,
  ) {
    super(api, 'RFYDevice', id, name);
  }
}

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class RFYAccessory {
  private service: Service;

  private rfy: typeof rfxcom.Rfy;

  /**
   * Accessory context
   */
  private context = {
    positionState: this.platform.Characteristic.PositionState.STOPPED,
    targetPosition: 0,
    currentPosition: 0,
  };

  constructor(
    private readonly platform: RFXCOMSomfy,
    private readonly accessory: PlatformAccessory,
  ) {
    // set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'loick111')
      .setCharacteristic(this.platform.Characteristic.Model, 'RFY Somfy RTS')
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        this.accessory.UUID,
      );

    // get the WindowCovering service if it exists, otherwise create a new WindowCovering service
    // you can create multiple services for each accessory
    this.service =
      this.accessory.getService(this.platform.Service.WindowCovering) ||
      this.accessory.addService(this.platform.Service.WindowCovering);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/WindowCovering
    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      this.accessory.displayName,
    );
    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentPosition)
      .on('get', this.getCurrentPosition.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.PositionState)
      .on('get', this.getPositionState.bind(this));

    this.service
      .getCharacteristic(this.platform.Characteristic.TargetPosition)
      .on('get', this.getTargetPosition.bind(this))
      .on('set', this.setTargetPosition.bind(this));

    // setup RFXCOM protocol
    this.rfy = new rfxcom.Rfy(this.platform.rfxcom, rfxcom.rfy.RFY);

    // make sure that accessory is closed by default if forceCloseAtStartup is true
    this.platform.rfxcom.on('ready', () => {
      if (this.accessory.context.device.forceCloseAtStartup) {
        this.rfy.doCommand(this.accessory.context.device.id, 'up');
      }
    });
  }

  /**
   * Handle requests to get the current value of the "Current Position" characteristic
   */
  getCurrentPosition(callback: CharacteristicGetCallback) {
    this.platform.log.debug('Triggered GET CurrentPosition');
    callback(null, this.context.currentPosition);
  }

  private setCurrentPosition(value) {
    this.platform.log.debug('setCurrentPosition: ', value);
    this.context.currentPosition = value;
    this.syncContext();
  }

  /**
   * Handle requests to get the current value of the "Position State" characteristic
   */
  getPositionState(callback: CharacteristicGetCallback) {
    this.platform.log.debug('Triggered GET PositionState');
    callback(null, this.context.positionState);
  }

  private setPositionState(state) {
    this.context.positionState = state;

    let stateName = '';
    switch (state) {
      case this.platform.Characteristic.PositionState.DECREASING:
        stateName = 'DECREASING';
        break;
      case this.platform.Characteristic.PositionState.INCREASING:
        stateName = 'INCREASING';
        break;
      case this.platform.Characteristic.PositionState.STOPPED:
        stateName = 'STOPPED';
        break;
      default:
        stateName = 'UNKNOWN -> ' + state;
        break;
    }

    this.platform.log.debug('setTargetPosition', stateName);
    this.syncContext();
  }

  /**
   * Handle requests to get the current value of the "Target Position" characteristic
   */
  getTargetPosition(callback: CharacteristicGetCallback) {
    this.platform.log.debug('Triggered GET TargetPosition');
    callback(null, this.context.targetPosition);
  }

  /**
   * Handle requests to set the "Target Position" characteristic
   */
  setTargetPosition(
    value: CharacteristicValue,
    callback: CharacteristicSetCallback,
  ) {
    this.platform.log.debug('Triggered SET TargetPosition: ' + value);
    this.context.targetPosition = +value;

    this.syncContext();
    const device = this.accessory.context.device;
    const positionState = this.platform.Characteristic.PositionState;

    // Action to perform
    let action = '';
    let newPositionValue = 0;

    // I set this range to replicate the Somfy remote contorl. A press on the up button will send a up command.
    // To stop this command you can press the "my" button to stop at a desired highted of the shutter. For this I
    // created a zone from 40 to 60 so we could press this "button". If it would be only 50 then after I stoped the
    // shutter it won't send the command again. This way we could press any number in the range of 40-60 and it will
    // act as another press on the "my" button.

    // between 40 to 60 we will handle this as the "my" button at Somfy's remote
    if (this.context.targetPosition >= 40 && this.context.targetPosition <= 60) {
      this.setPositionState(positionState.DECREASING);
      action = 'program';
      newPositionValue = 50;
    }
    // under 40 will mean we want to close the shutter.
    else if (this.context.targetPosition < 40) {
      this.setPositionState(positionState.DECREASING);
      action = 'down';
      newPositionValue = 0;
    }
    // above 60 mean we want to open the shutter.
    else {
      this.setPositionState(positionState.INCREASING);
      action = 'up';
      newPositionValue = 100;
    }

    // update the new target position after we move to the final position.
    this.context.targetPosition = +newPositionValue;


    // Action
    this.platform.log.debug('action: ' + action);
    this.platform.log.debug('deviceId: ' + device.id);
    this.rfy.doCommand(device.id, action);

    const moveTimeMs = 50;
    setTimeout(() => {
      // I am not sure why I need to send stop after program but it won't work if I don't.
      if (newPositionValue == 50) {
        this.platform.log.debug('sending stop after: ' + moveTimeMs);
        this.rfy.doCommand(device.id, 'stop');
        this.setPositionState(
          this.platform.Characteristic.PositionState.STOPPED,
        );
      }
    }, moveTimeMs);


    this.platform.log.debug('set new position value: ' + newPositionValue);
    // Set the current position value for homekit to show the change of the shutter status.
    this.setCurrentPosition(+newPositionValue);

    callback();
  }

  private syncContext() {
    this.service.updateCharacteristic(
      this.platform.Characteristic.PositionState,
      this.context.positionState,
    );
    this.service.updateCharacteristic(
      this.platform.Characteristic.TargetPosition,
      this.context.targetPosition,
    );
    this.service.updateCharacteristic(
      this.platform.Characteristic.CurrentPosition,
      this.context.currentPosition,
    );
  }
}
