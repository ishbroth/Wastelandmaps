import UIKit
import CarPlay

/// iOS creates this only when a CarPlay car connects and the app holds Apple's CarPlay navigation entitlement. Until then it is never used, and the phone's map is all
/// anyone sees.
class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
    func templateApplicationScene(_ templateApplicationScene: CPTemplateApplicationScene, didConnect interfaceController: CPInterfaceController, to window: CPWindow) {
        CarPlayHub.shared.connect(interfaceController: interfaceController, window: window)
    }

    func templateApplicationScene(_ templateApplicationScene: CPTemplateApplicationScene, didDisconnectInterfaceController interfaceController: CPInterfaceController, from window: CPWindow) {
        CarPlayHub.shared.disconnect()
    }
}
