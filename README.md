# Stargazer

A wallet application for the [Stellar](https://stellar.org) platform. Desktop and Mobile.


## Main features:

* Multiple accounts

* Multiple assets
    * Issue/Redeem
    * Send/Receive/Trade

* Multiple networks

* Send to
    * Stellar addresses
    * Federated addresses
    * Email addresses

* Create/receive payment requests

* Add contacts
    * using QR code
    * from a transaction

* Add comments to transactions

* Import/export accounts
    * QR code
    * Manual input


## Security

All private keys are stored in localStorage, encrypted or not. Within the app, key decryption and transaction signing all take place inside the `Keychain` service in `app/core/services/keychain.js`. The only time an unencrypted private key leaves that service is when an account is being exported and you're not using password protection.


## Translations

- Go to [https://crowdin.com/project/stargazer]() and sign up.
- Select the language you want to translate.
- Select the "en.json" file.
- Start translating words/phrases.

*NB: Some of the phrases contains placeholders, e.g. `{{key}}`, where the placeholder `key` mustn't be translated.
Some of the phrases, specifically the `XX days/hours/minutes/seconds ago` ones, have both a singular and a plurar form that should be translated.*


## Build instructions

### Building the baseline app
```
npm install
bower install
grunt build
```

### Building for desktop
```
cd electron
npm install
npm run start
```

### Building for mobile
```
cd ionic
npm install -g ionic
npm install

ionic resources android --icon
ionic state restore
npm run start
```

or try:

```
cd ./stargazer/ionic;
 npm install -g ionic;
 npm install
 ionic resources android --icon 
 ionic state restore

 cd ..
 npm install
 npm install -g grunt 
 grunt build

 npm install -g cordova
 
bower install

./android.sh  // builds new apk

to rebuild another new version apk seems I need to delete or rename the old one and run  ./android.sh again

mv ./stargazer/ionic/platforms/android/build/outputs/apk/android-debug.apk ./stargazer/ionic/platforms/android/build/outputs/apk/android-debug.apk.org

or 

rm ./stargazer/ionic/platforms/android/build/outputs/apk/android-debug.apk

./android.sh

for added webcam support in android emulator:

curl -s "https://get.sdkman.io" | bash

source "$HOME/.sdkman/bin/sdkman-init.sh"

sdk version

sdk install gradle

```


## License

**Stargazer** is released under the **GNU Affero General Public License v3** (AGPL), except for the following files:

* app/core/controllers/scanner.js
* app/core/directives/qr-scanner.js
* app/core/services/platform-info.js

which originate from **Copay**, and are made available under the terms of the **MIT License**.

Copyright &copy; 2016-2017 Future Tense, LLC
