import UIKit
import WebKit

/// The map on the car's screen: the very same map as the phone's (the web app in its "car" mode: the Pip-Boy green map, the same icons, the same route trail), drawn
/// in a web view that fills the car's window. The web app pushes what to show (position, route, places) and this page just displays it; it takes no touches.
final class CarMapViewController: UIViewController, WKNavigationDelegate {
    /// The web app, in car mode (see src/car/CarApp.tsx). It is loaded from the live site, so it looks exactly as the phone's does and needs no second copy in the app.
    static let pageURL = URL(string: "https://wastelandmaps.com/?car=1")!

    private let web: WKWebView
    private var loaded = false
    private var pending: String?

    init() {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        web = WKWebView(frame: .zero, configuration: configuration)
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not used")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.008, green: 0.075, blue: 0.031, alpha: 1)
        web.frame = view.bounds
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        web.isOpaque = false
        web.backgroundColor = view.backgroundColor
        web.scrollView.isScrollEnabled = false
        web.scrollView.backgroundColor = view.backgroundColor
        web.isUserInteractionEnabled = false
        web.navigationDelegate = self
        view.addSubview(web)
        web.load(URLRequest(url: Self.pageURL))
    }

    /// Hands the page the newest state (kept until the page has loaded).
    func show(json: String) {
        pending = json
        flush()
    }

    private func flush() {
        guard loaded, let json = pending else { return }
        web.evaluateJavaScript("window.carUpdate && window.carUpdate(\(json))", completionHandler: nil)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loaded = true
        flush()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        retry()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        retry()
    }

    /// No signal for a moment: try again shortly.
    private func retry() {
        loaded = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) { [weak self] in
            guard let self = self else { return }
            self.web.load(URLRequest(url: Self.pageURL))
        }
    }
}
