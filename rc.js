// Get references to UI elements
let deviceCache = null;
// Characteristic object cache
let characteristicCache = null;

// Launch Bluetooth device chooser and connect to the selected
function connect() {
  return (deviceCache ? Promise.resolve(deviceCache) :
      requestBluetoothDevice()).
      then(device => connectDeviceAndCacheCharacteristic(device)).
      then(characteristic => startNotifications(characteristic)).
      catch(error => log(error));
}

function requestBluetoothDevice() {
  log('Requesting bluetooth device...');

  return navigator.bluetooth.requestDevice({
    filters: [{services: [0xFFE0]}],
  }).
      then(device => {
        log('"' + device.name + '" bluetooth device selected');
        deviceCache = device;

        return deviceCache;
      });
}

// Connect to the device specified, get service and characteristic
function connectDeviceAndCacheCharacteristic(device) {
  if (device.gatt.connected && characteristicCache) {
    return Promise.resolve(characteristicCache);
  }

  log('Connecting to GATT server...');

  return device.gatt.connect().
      then(server => {
        log('GATT server connected, getting service...');

        return server.getPrimaryService(0xFFE0);
      }).
      then(service => {
        log('Service found, getting characteristic...');

        return service.getCharacteristic(0xFFE1);
      }).
      then(characteristic => {
        log('Characteristic found');
        characteristicCache = characteristic;

        return characteristicCache;
      });
}

// Enable the characteristic changes notification
function startNotifications(characteristic) {
  log('Starting notifications...');

  return characteristic.startNotifications().
      then(() => {
        log('Notifications started');
		characteristic.addEventListener('characteristicvaluechanged',
            handleCharacteristicValueChanged);
      });
}

// Output to terminal
function log(data) {
  console.log(data);
}

// Disconnect from the connected device
function disconnect() {
  if (deviceCache) {
    log('Disconnecting from "' + deviceCache.name + '" bluetooth device...');
    deviceCache.removeEventListener('gattserverdisconnected',
        handleDisconnection);

    if (deviceCache.gatt.connected) {
      deviceCache.gatt.disconnect();
      log('"' + deviceCache.name + '" bluetooth device disconnected');
    }
    else {
      log('"' + deviceCache.name +
          '" bluetooth device is already disconnected');
    }
  }

  characteristicCache = null;
  deviceCache = null;
}

function handleDisconnection(event) {
  let device = event.target;

  log('"' + device.name +
      '" bluetooth device disconnected, trying to reconnect...');

  connectDeviceAndCacheCharacteristic(device).
      then(characteristic => startNotifications(characteristic)).
      catch(error => log(error));
}

// Send data to the connected device
function send(data) {
  data = String(data);

  if (!data || !characteristicCache) {
    return;
  }

  data += '\n';

  if (data.length > 20) {
    let chunks = data.match(/(.|[\r\n]){1,20}/g);

    writeToCharacteristic(characteristicCache, chunks[0]);

    for (let i = 1; i < chunks.length; i++) {
      setTimeout(() => {
        writeToCharacteristic(characteristicCache, chunks[i]);
      }, i * 100);
    }
  }
  else {
    writeToCharacteristic(characteristicCache, data);
  }
}

function writeToCharacteristic(characteristic, data) {
  characteristic.writeValue(new TextEncoder().encode(data));
}

// Intermediate buffer for incoming data
let readBuffer = '';

// Data receiving
function handleCharacteristicValueChanged(event) {
  let value = new TextDecoder().decode(event.target.value);
  log(value);

  for (let c of value) {
    if (c === '\n') {
      let data = readBuffer.trim();
      readBuffer = '';

      if (data) {
        receive(data);
      }
    }
    else {
      readBuffer += c;
    }
  }
}

// Received data handling
function receive(data) {
  log(data);
}
