<p align="center">
    <img src="https://raw.githubusercontent.com/homebridge/branding/latest/logos/homebridge-wordmark-logo-vertical.png" width="150">
</p>


# Homebridge RFXCOM Somfy Roller Shutter

This Homebridge plugin allows to control Somfy roller shutters. The plugin is based on the general version that Loick MAHIEUX developed. My version is a fork that mimics the Somfy RTS remote contorl behaviour.
If you need a general plugin that can control multiple types of RTS products and in general devices that are compatible with RFXCOM then please check Loick MAHIEUX plugin homebridge-rfxcom-accessories.

### Homekit window control usage
<p align="center">
    <img src="https://github.com/om-ka/homebridge-rfxcom-somfy/assets/40441257/b607cba1-5ab0-40e1-9074-061979136064" width="150">
</p>

This plugin mimics the Somfy remote control. The Homekit window control allows users to set a specific percentage of the window open or close. Since Somfy RTS roller shutters don't provide their current state, any implementation of window open or closed percentage is a calculated guess.\
I changed this plugin to mimic the Somfy remote contorl. This means that if you press more than 60% open the plugin will determein you pressed "up" and open the window. If you press less than 40% open the plugin will determain you pressed "down" and close the window. In the area between 40% and 60% the plugin will determain you pressed the "my" button.\
The "my" button allows you to stop the window going up or going down. A second press on the "my" button will send the program command that will move the window to a preset position that you have setup prior.\
To mimic multiple presses on the "my" button one could press a bit above or below 50% as all options between 40-60 will turn into 50% eventually.

## How to use

You can add this plugin to your Homebridge instance by adding the following npm package:

```
npm install homebridge-rfxcom-somfy
```

## Configuration

Global configuration of this plugin containing Homebridge parameters and RFXCOM parameters.

```json
{
  "name": "RFXCOM Somfy",
  "platform": "RFXCOMSomfy",
  "tty": "/dev/ttyUSB0",
  "debug": false
}
```

### Hardware
I used RFXtrx433XL USB controller that works well. This controller supports multiple devices and protocols. My setup includes a Raspberry Pi 4 with 4GB running Homebridge raspbian image.

<p align="center">
    <a href="http://www.rfxcom.com/RFXtrx433XL-USB-43392MHz-Transceiver">
    <img src="http://www.rfxcom.com/WebRoot/StoreNL2/Shops/78165469/5B8A/5E1D/4494/B351/E87F/0A0C/6D07/33B5/RFXtrx433E_new_ml.JPG" width="150">
    </a>
    </p>

### RFY (Somfy RTS)

RFY Somfy RTS can control blinds, awning, but my version of the plugin is specific for the Somfy roller shutter. I don't have any other Somfy products and I don't know how they work so it's possible that this plugin could work for such products but it's not tested.\
You need to associate first your RFXCOM to the wanted device with an external tool (more details bellow).

```json
{
  "devices": {
    "rfy": [
      {
        "name": "Kitchen Window",
        "deviceId": "0x000610/1",
        "openCloseDurationSeconds": "20",
        "forceCloseAtStartup": false
      }
    ]
  }
}
```
### RFXMngr and pairing remotes
I am saving the RFXCOM manual [here](https://github.com/om-ka/homebridge-rfxcom-somfy/blob/c5f4ee3bb8248c3373590723b5b9a574f530b15b/RFXtrx_User_Guide.pdf) for future reference, please read page 50 for Somfy RTS pairing.\
The official tool `RFXMngr` that I used is running only on Windows.

**My notes from the install process:**\
Each Somfy motor needs to be paired with the RFX controller. According to the documentation of RFXCOM some motors have a limit of 10 remotes so make sure you are not passing this limit.\
The manual asks to disconnect power for all the devices except the one you want to pair. I didn't do this and had no issues. I guess some remotes control more than a single motor and that could create an issue.
