import UIKit
import CarPlay
import MapKit

/// What the web app tells the car, each time something changes while it is navigating. `json` is the whole thing, as the web app sent it: the car's map page draws from
/// that (the route, the places, where the car is). The other fields are what CarPlay's own turn banner and trip estimates need.
struct CarState {
    var active: Bool
    var destination: String
    var destinationCoordinate: CLLocationCoordinate2D
    var here: CLLocationCoordinate2D
    var instruction: String
    var distanceToTurn: Double
    var remainingMeters: Double
    var remainingSeconds: Double
    var json: String
}

/// The one place the car screen is kept. It does nothing at all until a car connects: iOS only starts the CarPlay scene (CarPlaySceneDelegate) when a car is plugged in or
/// connected wirelessly AND the app has Apple's CarPlay entitlement (see CARPLAY.md). With neither, none of this runs and the phone's own map is all there is.
final class CarPlayHub: NSObject, CPMapTemplateDelegate {
    static let shared = CarPlayHub()

    private var interface: CPInterfaceController?
    private var mapTemplate: CPMapTemplate?
    private var mapController: CarMapViewController?
    private var session: CPNavigationSession?
    private var trip: CPTrip?
    private var tripKey = ""
    private var latest: CarState?

    /// Told when a car connects or goes away, and when the person ends the trip on the car's own screen.
    var onConnectionChange: ((Bool) -> Void)?
    var onEndRequested: (() -> Void)?

    var isConnected: Bool { interface != nil }

    func connect(interfaceController: CPInterfaceController, window: CPWindow) {
        interface = interfaceController
        let controller = CarMapViewController()
        mapController = controller
        window.rootViewController = controller

        let template = CPMapTemplate()
        template.mapDelegate = self
        mapTemplate = template
        interfaceController.setRootTemplate(template, animated: false, completion: nil)

        onConnectionChange?(true)
        if let state = latest { apply(state) }
    }

    func disconnect() {
        session?.cancelTrip()
        session = nil
        trip = nil
        tripKey = ""
        mapTemplate = nil
        mapController = nil
        interface = nil
        onConnectionChange?(false)
    }

    /// The web app's newest state. Kept, so a car that connects mid-route shows the route at once.
    func apply(_ state: CarState) {
        latest = state
        guard isConnected, let template = mapTemplate else { return }
        mapController?.show(json: state.json)
        if !state.active { finish(); return }

        let key = "\(state.destination)|\(state.destinationCoordinate.latitude)|\(state.destinationCoordinate.longitude)"
        if session == nil || key != tripKey { begin(state, template: template, key: key) }

        let maneuver = CPManeuver()
        maneuver.instructionVariants = [state.instruction]
        maneuver.symbolImage = UIImage(systemName: Self.symbol(for: state.instruction))
        session?.upcomingManeuvers = [maneuver]
        let toTurn = Measurement(value: max(0, state.distanceToTurn), unit: UnitLength.meters)
        session?.updateEstimates(CPTravelEstimates(distanceRemaining: toTurn, timeRemaining: max(0, state.distanceToTurn / 10)), for: maneuver)
        if let trip = trip {
            let left = Measurement(value: max(0, state.remainingMeters), unit: UnitLength.meters)
            template.updateEstimates(CPTravelEstimates(distanceRemaining: left, timeRemaining: max(0, state.remainingSeconds)), for: trip)
        }
    }

    /// A banner on the car's screen (a place discovered along the way, say).
    func alert(title: String, subtitle: String) {
        guard let template = mapTemplate else { return }
        let alert = CPNavigationAlert(titleVariants: [title], subtitleVariants: [subtitle], image: nil, primaryAction: CPAlertAction(title: "OK", style: .default) { _ in }, secondaryAction: nil, duration: 6)
        template.present(navigationAlert: alert, animated: true)
    }

    private func begin(_ state: CarState, template: CPMapTemplate, key: String) {
        session?.cancelTrip()
        let origin = MKMapItem(placemark: MKPlacemark(coordinate: state.here))
        let destination = MKMapItem(placemark: MKPlacemark(coordinate: state.destinationCoordinate))
        destination.name = state.destination
        let choice = CPRouteChoice(summaryVariants: [state.destination], additionalInformationVariants: [], selectionSummaryVariants: [state.destination])
        let newTrip = CPTrip(origin: origin, destination: destination, routeChoices: [choice])
        trip = newTrip
        tripKey = key
        session = template.startNavigationSession(for: newTrip)
    }

    private func finish() {
        session?.finishTrip()
        session = nil
        trip = nil
        tripKey = ""
    }

    /// A rough arrow for the turn, from what the instruction says.
    private static func symbol(for instruction: String) -> String {
        let t = instruction.lowercased()
        if t.contains("u-turn") { return "arrow.uturn.left" }
        if t.contains("left") { return "arrow.turn.up.left" }
        if t.contains("right") { return "arrow.turn.up.right" }
        if t.contains("destination") || t.contains("arrive") { return "flag.fill" }
        return "arrow.up"
    }

    // MARK: CPMapTemplateDelegate

    /// The person ended the trip on the car's screen.
    func mapTemplateDidCancelNavigation(_ mapTemplate: CPMapTemplate) {
        finish()
        onEndRequested?()
    }
}
