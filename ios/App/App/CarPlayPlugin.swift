import Foundation
import Capacitor
import CoreLocation

/// The web app's way to talk to the car's screen. Everything here is harmless without a car: the calls are kept (so a car that connects mid-route shows the route) and
/// nothing is drawn.
///   CarPlay.update({ active, destination, destLat, destLng, hereLat, hereLng, path, steps, step, instruction, distanceToTurn, remainingMeters, remainingSeconds, markers })  (see src/lib/carplay.ts)
///   CarPlay.end()       the trip is over
///   CarPlay.alert({ title, subtitle })    a banner on the car's screen
///   CarPlay.status()    { connected }
/// Events: "connection" ({ connected }) when a car connects or goes away, and "endRequested" when the person ends the trip on the car's own screen.
@objc(CarPlayPlugin)
public class CarPlayPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CarPlayPlugin"
    public let jsName = "CarPlay"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "alert", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
    ]

    override public func load() {
        CarPlayHub.shared.onConnectionChange = { [weak self] connected in
            self?.notifyListeners("connection", data: ["connected": connected])
        }
        CarPlayHub.shared.onEndRequested = { [weak self] in
            self?.notifyListeners("endRequested", data: [:])
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(["connected": CarPlayHub.shared.isConnected]) }
    }

    @objc func update(_ call: CAPPluginCall) {
        // the whole update goes to the car's map page as it is; a few of its fields also feed CarPlay's own turn banner
        var options: [String: Any] = [:]
        for (key, value) in call.options {
            if let name = key as? String, name != "callbackId" { options[name] = value }
        }
        let json = (try? JSONSerialization.data(withJSONObject: options)).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        let state = CarState(
            active: call.getBool("active") ?? false,
            destination: call.getString("destination") ?? "",
            destinationCoordinate: CLLocationCoordinate2D(latitude: call.getDouble("destLat") ?? 0, longitude: call.getDouble("destLng") ?? 0),
            here: CLLocationCoordinate2D(latitude: call.getDouble("hereLat") ?? 0, longitude: call.getDouble("hereLng") ?? 0),
            instruction: call.getString("instruction") ?? "",
            distanceToTurn: call.getDouble("distanceToTurn") ?? 0,
            remainingMeters: call.getDouble("remainingMeters") ?? 0,
            remainingSeconds: call.getDouble("remainingSeconds") ?? 0,
            json: json
        )
        DispatchQueue.main.async {
            CarPlayHub.shared.apply(state)
            call.resolve()
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let state = CarState(active: false, destination: "", destinationCoordinate: CLLocationCoordinate2D(), here: CLLocationCoordinate2D(), instruction: "", distanceToTurn: 0, remainingMeters: 0, remainingSeconds: 0, json: "{\"active\":false}")
            CarPlayHub.shared.apply(state)
            call.resolve()
        }
    }

    @objc func alert(_ call: CAPPluginCall) {
        let title = call.getString("title") ?? ""
        let subtitle = call.getString("subtitle") ?? ""
        DispatchQueue.main.async {
            CarPlayHub.shared.alert(title: title, subtitle: subtitle)
            call.resolve()
        }
    }
}
