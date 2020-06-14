module.exports = function(RED) {

	// Can't use undeclared variables for clean code
	"use strict";

	const NODE_NAME = 'ss963 Service Node';

	/*
		---------------------------------------------------------------
	*/
    function driverNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

		is_raspberry();
		is_spi_exists();
		is_service_running();;

		// -------------------------------------------
		node.on('close', function() {
        	RED.log.info(NODE_NAME + ': Node closed.');
			RED.comms.publish('A message to admin');
		});

		// -------------------------------------------
		node.on('input', function(msg) {

			try {
		        node.status({ fill:"green", shape:"dot", text: node.portCount});
				// Array.isArray(msg.payload))

			} catch (error) {

                node.status( {fill:"red", shape:"dot", text:error.message} );
                node.error(error.message);
                throw(error);

			} finally {
	            node.send(msg);
			}
        });


		// ----------------------------------------------------------
		function  is_raspberry() {
	        // Check Raspberry Pi Hardware
	        var isPi = require('detect-rpi');
	        if (!isPi())
	            node.error("This is Raspberry Pi specific node.");
		}

		function is_spi_exists() {
	        // Check SPI Enabled
	        const fs = require('fs')
    	    if (!fs.existsSync('/dev/spidev0.0'))
	            node.error("There is no SPI port!");
		}

		function is_service_running() {
	        // Check SHM Listener Service
	        const { exec } = require("child_process");
	        exec("sudo systemctl status apache2 | grep active",
	            (error, stdout, stderr) => {
	                if (!stdout.includes("Active: active (running)")) {
	                    node.error("SHM Listener driver not loaded.");
	                    node.status( {fill:"red", shape:"dot", text: "Servis is not runnig!"} );
	                } else
	                    node.status( {fill:"green", shape:"dot", text: "ss963.service is runnig"} );
    	        });
		}

		function getServiceConfigurationAsJSON(fileName) {
			const fs = require('fs');
            const ini = require('ini');
            const path = require("path");
            return ini.parse(fs.readFileSync(path.resolve(__dirname, fileName), 'utf-8'));
		}

		// -------------------------------------------------
        RED.httpAdmin.get("/saveServiceConfigFile", RED.auth.needsPermission('ss963Service.write'), function(req, res) {

			const fs = require('fs');
			const ini = require('ini');
			const path = require("path");

			var config = {
				PORT_COUNT: req.query.PORT_COUNT ,
                LATCH_PIN: req.query.LATCH_PIN,
                LATCH_DELAY: req.query.LATCH_DELAY,
                SPEED: req.query.SPEED,
                LOOP_DELAY_US: req.query.LOOP_DELAY_US
			}
			fs.writeFileSync(path.resolve(__dirname, "service.conf"), ini.stringify(config, {}))
			node.status( {fill:"blue", shape:"ring", text: "ss963.service restarted."} );
        });

		// -------------------------------------------------
        RED.httpAdmin.get("/getServiceConfFile", RED.auth.needsPermission('ss963Service.read'), function(req, res) {

            const fs = require('fs');
            const ini = require('ini');
            const path = require("path");
    	    res.json(ini.parse(fs.readFileSync(path.resolve(__dirname, "service.conf"), 'utf-8')));
        });

    }
    RED.nodes.registerType("ss963-driver", driverNode);
}
