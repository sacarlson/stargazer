/* global angular, console, StellarSdk */

angular.module('app')
.controller('IndexCtrl', function ($http, $ionicBody, $ionicLoading, $ionicPopup, $location, $q, $rootScope, $scope, $translate, Contacts, Horizon, Keychain, Language, Modal, Storage, Wallet) {
	'use strict';

	$scope.physicalScreenWidth = ((window.innerWidth > 0) ? window.innerWidth : screen.width);

	function handleAccountImport(account, key) {

		var data = window.btoa(JSON.stringify({
			account: account,
			key: key
		}));
		$location.path('/side-menu/import-account/' + data);
	}

	function handleAccount(account) {

		if (!(account.id in Wallet.accounts) && !Contacts.lookup(account.id, account.network)) {

			$scope.model = {
				id:			account.id,
				meta:		account.meta,
				meta_type:	account.meta_type
			};

			if (account.network) {
				$scope.model.network = account.network;
			}

			Modal.show('app/account/modals/add-contact.html', $scope);
		}
	}

	function handlePayment(payment) {
        payment.amount = parseFloat(payment.amount);
		var object = {
			destination:	payment.destination,
			amount:			payment.amount
		};

		if (!payment.asset) {
			object.asset_type	= 'native';
		} else {
			object.asset_code	= payment.asset.code;
			object.asset_issuer	= payment.asset.issuer;
		}

		if (payment.memo) {
			object.memo = payment.memo;
		}

		$location.path('/account/send')
		.search(object);
	}

	function handleChallenge(challenge) {

		var id = challenge.id ? challenge.id : Wallet.current.id;

		if (Keychain.isLocalSigner(id)) {
			Keychain.signMessage(id, challenge.message)
			.then(function (sig) {

				$ionicLoading.show({
					template: 'Submitting response...'
				});

				$http.post(challenge.url, {
					id: id,
					msg: challenge.message,
					sig: sig
				})
				.then(function (res) {
					$ionicLoading.hide();
				}, function (err) {
					$ionicLoading.hide();
				});
			});
		}
	}

     function get_remote_tx_v2_2(xml_url,txTag){
       // version 2.0
       console.log("started get_remote_tx");
       console.log("xml_url");
       var client = setup_xml(xml_response_get_remote_tx)
       client.open("GET", xml_url + 'tx_tag=' + txTag, true); 
       client.send();
     }

    function get_remote_tx_v2(xml_url,txTag,version){
       // version <= 2.0
       // xml_url = http://b.funtracker.site/store/?route=extension/payment/stellar_net/get_tx&
       // send:
       //http://b.funtracker.site/store/?route=extension/payment/stellar_net/get_tx&ver=3.0&tx_tag=70
       console.log("started get_remote_tx");
       console.log("xml_url: ",xml_url);
       console.log("tx_tag: ", txTag);
       console.log("version: ", version);
       var client = setup_xml(xml_response_get_remote_tx);
       client.open("GET", xml_url + 'tx_tag=' + txTag + "&ver=" + version, true); 
       client.send();
     }

    var remote_txData;

    function xml_response_get_remote_tx(data){
        console.log("xml_response get_remote_tx: ");
        // versions > 2.0
//Object { destination: "GDUPQLNDVSUKJ4XKQQDITC7RFYCJTROCR6A…", amount: "204.9900", asset: "USD", issuer: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCG…", memo: "32" }
       // versions <= 2.0 we use stargazer transaction format and or branches of it with added escrow at V3.0 and above
       //{"stellar":{"payment":{"destination":"GDUPQLNDVSUKJ4XKQQDITC7RFYCJTROCR6AMUBAMPGBIZXQU4UTAGX7C","network":"cee0302d","amount":"106.0000","asset":{"code":"USD","issuer":"GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ"},"memo":{"type":"text","value":"19"},"order_status":"Processed","escrow":{"publicId":"GAVUFP3ZYPZUI2WBSFAGRMDWUWK2UDCPD4ODIIADOILQKB4GI3APVGIF","email":"funtracker.site.bank@gmail.com","expire_ts":1491268194,"expire_dt":"2017-04-04","fee":275,"callback":"http:\/\/b.funtracker.site\/store\/?route=extension\/payment\/stellar_net\/submit_escrow&"}},"version":"3.0"}}
//remote_txData.stellar.payment.escrow.fee
        console.log("original data: ");
        console.log(data);

        if (data == "escrow_submit_accepted"){
          // responce back from OpenCart escrow submit as good
          //tx_status.textContent = "Escrow Submit Accpeted";
          alert("escrow_submit_accepted");
          return;
        }
        
        //data = decodeURI(data);
        //data = decodeURIComponent(data);
        //return;
        remote_txData = JSON.parse(data);
        console.log("remote_txData");
        console.log(remote_txData);
        if (typeof remote_txData.content != "undefined") {
          // multisig app format return
          console.log(remote_txData.content.tx.tx_xdr);
          //fill_envelope_b64(remote_txData.content.tx.tx_xdr);
          remote_txData.b64_escrow_tx = remote_txData.content.tx.tx_xdr; 
        }
        if (typeof remote_txData.stellar != "undefined") {
          // stargazer app format return
          console.log("stellar stargazer format detected");
          if (remote_txData.stellar.payment.order_status != null){
            console.log("order_status: " , remote_txData.stellar.payment.order_status);
            //tx_status.textContent = "Order Status: " + remote_txData.stellar.payment.order_status;
            return;
          }
          //stargazer_payment_convert(remote_txData);
           // we should get this from the store: remote_txData.payment.escrow.callback
          if (typeof remote_txData.stellar.version != "undefined"){
            // version is added when data from OpenCart plugin return format starting at V3.0 escrow 
            console.log("version number detected: ",remote_txData.stellar.version); 
// non existant transaction, note amount: null
//{"stellar":{"payment":{"destination":"GDUPQLNDVSUKJ4XKQQDITC7RFYCJTROCR6AMUBAMPGBIZXQU4UTAGX7C","network":"cee0302d","amount":null,"asset":{"code":"USD","issuer":"GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ"},"memo":{"type":"text","value":"88"},"order_status":null,"escrow":{"publicId":"GAVUFP3ZYPZUI2WBSFAGRMDWUWK2UDCPD4ODIIADOILQKB4GI3APVGIF","email":"funtracker.site.bank@gmail.com","expire_ts":1491119564,"expire_dt":"2017-04-02","status":"0","fee":10,"callback":"http:\/\/b.funtracker.site\/store\/?route=extension\/payment\/stellar_net\/submit_escrow&"}},"version":"3.0"}}

            if (remote_txData.stellar.version == "3.0"){
              console.log("remote_txData version 3.0 detected, will perform escrow setup");
              if (remote_txData.stellar.payment.escrow.status != "10"){
                console.log("order_status: " , remote_txData.stellar.payment.escrow.status);
                if (remote_txData.stellar.payment.escrow.status == "0"){
                  //tx_status.textContent = "Escrow Status Proccessing "
                  console.log("Escrow Status on this transaction is already Proccessing ");
                  alert("Escrow Status on this transaction is already Proccessing (0)");
                  // we should clear these values to prevent repeat spending
                  //destination.value = "";
                  //amount.value = "";
                }else if (remote_txData.stellar.payment.escrow.status == "1"){
                  //tx_status.textContent = "Escrow Status Proccessed "
                  console.log("Escrow Status on this transaction already Proccessed ");
                  alert("Escrow Status on this transaction already Proccessed (1)");               
                  //destination.value = "";
                  //amount.value = "";
                }else if (remote_txData.stellar.payment.amount != null){
                  console.log("Escrow Status amount != null so transaction has already been processed but may have problem error code: " + remote_txData.stellar.payment.escrow.status);
                  alert("Escrow Status amount != null so transaction has already been processed but may have problem error code: " + remote_txData.stellar.payment.escrow.status);
                }else{
                  //tx_status.textContent = "Escrow Status failed error: " + remote_txData.stellar.payment.escrow.status;
                  console.log("Escrow Status failed error: " + remote_txData.stellar.payment.escrow.status);
                  alert("Escrow Status failed error: " + remote_txData.stellar.payment.escrow.status);
                  //destination.value = "";
                  //amount.value = "";
                }
                return;
              }
              alert("Escrow Transaction detected:  An Escrow service fee of: " + remote_txData.stellar.payment.escrow.fee + " XLM will be added to your purchase if submited"); 
              escrow_setup();
              return;
            }
          }          
          //return;
        }

        if (typeof remote_txData.destination != "undefined"){
          //my_wallet V1.0 format detected, convert to stargazer format V2.1
          remote_txData.stellar = {};
          remote_txData.stellar.payment = {};
          remote_txData.stellar.payment.asset = {};
          remote_txData.stellar.payment.memo = {};
          remote_txData.stellar.payment.destination = remote_txData.destination;
          remote_txData.stellar.payment.amount = remote_txData.amount;
          remote_txData.stellar.payment.asset.code = remote_txData.asset;
          remote_txData.stellar.payment.asset.issuer = remote_txData.issuer;
          remote_txData.stellar.payment.memo.type = "text";
          remote_txData.stellar.payment.memo.value = remote_txData.memo;
          if (remote_txData.network == "live"){
            //live net
            remote_txData.stellar.payment.network = "7ac33997";
          }else{
            //testnet (default)
            remote_txData.stellar.payment.network = "cee0302d";
          }
        }
        
        data = remote_txData;

        if (!data.stellar) {
			return;
		}
        

		if (data.stellar.account) {
			if (data.stellar.key) {
				handleAccountImport(data.stellar.account, data.stellar.key);
			} else {
				handleAccount(data.stellar.account);
			}
		}

		else if (data.stellar.payment) {           
			handlePayment(data.stellar.payment);
		}

		else if (data.stellar.challenge) {
			handleChallenge(data.stellar.challenge);
		}                  
     }

    function xml_response_get_remote_tx2(data){
        console.log("xml_response get_remote_tx: ");

        console.log(data);
        data = decodeURI(data);
        data = JSON.parse(data);

        if (!data.stellar) {
			return;
		}
        

		if (data.stellar.account) {
			if (data.stellar.key) {
				handleAccountImport(data.stellar.account, data.stellar.key);
			} else {
				handleAccount(data.stellar.account);
			}
		}

		else if (data.stellar.payment) {
			handlePayment(data.stellar.payment);
		}

		else if (data.stellar.challenge) {
			handleChallenge(data.stellar.challenge);
		}       
     }

     function setup_xml(callback) {
       var xmlhttp_ = new XMLHttpRequest();
       xmlhttp_.onreadystatechange = function() {
         if (this.readyState == 4 && this.status == 200) {
           //var data = JSON.parse(this.responseText);
           callback(this.responseText);
         }
       };
       return xmlhttp_
     }
    
     //var keystore = Keychain.getKeyInfo(Wallet.current.id);
     //var current_keypair = StellarSdk.Keypair.fromSecret(keyStore);
     var current_keypair = StellarSdk.Keypair.fromSecret(Keychain.getKeyInfo(Wallet.current.id));
     var network = Wallet.current.network;
     console.log("network");
     console.log(network);
     var pub = "Public Global Stellar Network ; September 2015";
     var tes = "Test SDF Network ; September 2015";        
     if (network == "7ac33997"){
       //StellarSdk.Network.usePublicNetwork;
       StellarSdk.Network.use(new StellarSdk.Network(pub));       
     } else{       
       //StellarSdk.Network.useTestNetwork;
       StellarSdk.Network.use(new StellarSdk.Network(tes));
     }

     var server = Horizon.getServer(Wallet.current.network);
     console.log("server");
     console.log(server);

     var transaction;

     function escrow_setup(){      
       // this will create a new random account, set it up as an escrow account. all data needed to set it up is in global remote_txData
       //remote_txData: {"stellar":{"payment":{"destination":"GDUPQLNDVSUKJ4XKQQDITC7RFYCJTROCR6AMUBAMPGBIZXQU4UTAGX7C","network":"cee0302d","amount":"85.0000","asset":{"code":"USD","issuer":"GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ"},"memo":{"type":"text","value":"70"},"order_status":null,"escrow":{"publicId":"GAVUFP3ZYPZUI2WBSFAGRMDWUWK2UDCPD4ODIIADOILQKB4GI3APVGIF","email":"funtracker.site.bank@gmail.com","expire_ts":1491268569,"expire_dt":"2017-04-04","fee":222.5,"callback":"http:\/\/b.funtracker.site\/store\/?route=extension\/payment\/stellar_net\/submit_escrow&"}},"version":"3.0"}}

      // //remote_txData.escrow_status  1= escrow_submition_ready escrow funded, 2 error 
       console.log("start escrow_setup");
       console.log(remote_txData);
       // I'm not sure this is the right thing to do, if the object is attached to Wallet in this way here then with changes to remote_txData
       // should be reflected in this Wallet.remote_txData object also in realtime? or only each time it is reassigned? 
       //Wallet.remote_txData = remote_txData;
       var keypair_escrow = StellarSdk.Keypair.random();
       var store_obj = {};
       store_obj.signers = keypair_escrow.secret();
       //Storage.setItem('account.escrow_' + remote_txData.stellar.payment.memo.value , store_obj);
       //Wallet.addAccount(accountId, seed, name, network);
       Wallet.addAccount(keypair_escrow.publicKey(), keypair_escrow.secret(), ('escrow_'+remote_txData.stellar.payment.memo.value), Wallet.current.network);
       //save_seed("escrow_"+remote_txData.stellar.payment.memo.value, "", keypair_escrow.secret() );
       remote_txData.keypair_escrow = keypair_escrow;
       // status will be changed to "Escrow Setup Mode" to show user that we are preparing for escrow tx
       // need way to provide feedback to user of state in stargazer
       //tx_status.textContent = "Escrow Setup not funded?";
       var tx_array = [];
 
       tx_array.push(StellarSdk.Operation.createAccount({
                   destination: keypair_escrow.publicKey(),
                   startingBalance: fix7dec(61)
                 }));

       var asset_obj;
       if (remote_txData.stellar.payment.asset.code == "XLM"){
         asset_obj = new StellarSdk.Asset.native();
       } else{
         asset_obj = new StellarSdk.Asset(remote_txData.stellar.payment.asset.code, remote_txData.stellar.payment.asset.issuer);
         tx_array.push(StellarSdk.Operation.changeTrust({asset: asset_obj,source:keypair_escrow.publicKey()}));
       }
       remote_txData.escrow_asset = asset_obj;

       var opts = {};
       opts.signer = {};
       // provide the store destination a signers slot on the escrow_publicId account
       opts.signer.ed25519PublicKey = remote_txData.stellar.payment.destination;
       opts.signer.weight = 1;
       console.log("opp setoption source: ",keypair_escrow.publicKey()); 
       opts.source = keypair_escrow.publicKey();
       tx_array.push(StellarSdk.Operation.setOptions(opts)); 
       //tx_array.push(StellarSdk.Operation.setOptions(clone(opts))); // not sure I'm going to need to do this or not

       // this is your present active accounts publicKey address that will also be used as source of funds (you are the customer)
       // I guess I won't need this unless I can figure out how to set keypair_escrow master signer weight to zero
       // so without this we will have to find a way to store and track the keypair_escrow key data in key storage
       //opts.signer.ed25519PublicKey = current_keypair.publicKey();
       //opts.signer.weight = 1;
       //opts.source = remote_txData.stellar.payment.escrow.publicId;
       //tx_array.push(StellarSdk.Operation.setOptions(opts)); 

       // escrows signers slot in the event of a problem with the transaction bettween store and you the customer
       opts.signer.ed25519PublicKey = remote_txData.stellar.payment.escrow.publicId;
       opts.signer.weight = 1;
       opts.source = keypair_escrow.publicKey();
       tx_array.push(StellarSdk.Operation.setOptions(opts));

       opts = {};
       
       //opts.masterWeight = 0;
       opts.lowThreshold = 2;
       opts.medThreshold = 2;
       opts.highThreshold = 2;
       opts.source = keypair_escrow.publicKey();
       tx_array.push(StellarSdk.Operation.setOptions(opts));

       // no source provided so funds comes from your current_keypair.PublicKey() account
       tx_array.push(StellarSdk.Operation.payment({
          destination: keypair_escrow.publicKey(),
          amount: fix7dec(remote_txData.stellar.payment.amount),
          asset: asset_obj
       }));

       //asset_obj = StellarSdk.Asset.native();
       // this is the fee payment to the escrow.publicId paid in native XLM from you the buyer
       // we skip this if no fee's from this escrow service provider
       if (remote_txData.stellar.payment.escrow.fee > 0){
         tx_array.push(StellarSdk.Operation.payment({
            destination: remote_txData.stellar.payment.escrow.publicId,
            amount: fix7dec(remote_txData.stellar.payment.escrow.fee),
            asset: StellarSdk.Asset.native()
         }));
       }

       server.loadAccount(current_keypair.publicKey())
          .then(function (account) { 
             var memo_tr = StellarSdk.Memo.text(remote_txData.stellar.payment.memo.value);           
             transaction = new StellarSdk.TransactionBuilder(account,{memo: memo_tr});
             console.log("es setup tx: ", transaction);
             tx_array.forEach(function (item) {
               transaction.addOperation(item);
             });
             transaction = transaction.build();
             // need to find were stargazer stores it's keypair to sign this (key?)
             transaction.sign(current_keypair);
             // we just created this key but haven't yet found a place to store it to recover dispute with 3rd party
             transaction.sign(keypair_escrow);
             console.log("escrow signed tx: " , transaction);
             //tx_status.textContent = "Escrow Submition Ready";
             remote_txData.escrow_status = 1;
             // we just need to store this global for now as stargazer has no remote sign or envelope viewer features 
             //fill_envelope_b64(transaction.toEnvelope().toXDR().toString("base64"));
             remote_txData.current_keypair = current_keypair;
             remote_txData.b64_escrow_tx = transaction.toEnvelope().toXDR().toString("base64");
             Wallet.remote_txData = remote_txData;
             console.log("Wallet.remote_txData: ",Wallet.remote_txData);
             //Wallet.remote_txData.escrow_status == 1
             //handlePayment(data.stellar.payment);
             handlePayment(remote_txData.stellar.payment);
          });
       
     }

     //have moved function send_escrow_to_callback(),submit_escrow(), fix7dec(string) added these functions to ./app/account/controllers/send.js
    

     function fix7dec(string) {
        var num = Number(string).toFixed(7);
        string = num.toString();
        return string;
     }


    
	$scope.onQrCodeScanned = function (data) {

        //data = decodeURI(data);
        console.log("data: " , data);
        var tmp_data; 
        try{
		  tmp_data = JSON.parse(data);
          console.log("json ok");                   
        } catch(err){
          console.log("failed JSON decode try dcodeURI");
          //console.log(err);
          //console.log(data);
          tmp_data = decodeURI(data);
          //tmp_data = decodeURIComponent(data);
          console.log("post decodeURI: ", tmp_data);
          tmp_data = JSON.parse(tmp_data);
        }

        data = tmp_data;
        console.log("after decode: " , data); 

        if (data.ver == "2.1"){
          get_remote_tx_v2(data.callback,data.tx_tag,data.ver);
        }else if(data.ver == "3.0"){
          get_remote_tx_v2(data.callback,data.tx_tag,data.ver);
          // what now?  for escrow mode
        } else {
		  if (!data.stellar) {
			  return;
		  }
        }

		if (data.stellar.account) {
			if (data.stellar.key) {
				handleAccountImport(data.stellar.account, data.stellar.key);
			} else {
				handleAccount(data.stellar.account);
			}
		}

		else if (data.stellar.payment) {
			handlePayment(data.stellar.payment);
		}

		else if (data.stellar.challenge) {
			handleChallenge(data.stellar.challenge);
		}
	};

	$rootScope.$on('$submitter.failed', function (event, err) {
		$ionicPopup.alert({
			title: $translate.instant(err)
		}).then(function () {
			//	:KLUDGE: ionic 1.3.2 messes up, so we have to manually remove this
			$ionicBody.removeClass('modal-open');
		});
	});
});
