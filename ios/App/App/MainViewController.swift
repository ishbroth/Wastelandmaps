import UIKit
import Capacitor

/// The phone's own screen (the web app), with the app's own plugins added to the ones Capacitor finds by itself.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(CarPlayPlugin())
    }
}
