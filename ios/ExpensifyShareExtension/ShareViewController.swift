import UIKit
import UniformTypeIdentifiers
import UserNotifications

class ShareViewController: UIViewController {

  private let appGroupId    = "group.com.finance.expensify"
  private let imageFileName = "pending_share.jpg"
  private let pendingKey    = "hasPendingShare"
  private let actionKey     = "pendingShareAction"

  private var loadedImageData: Data?
  private var extensionCompleted = false

  // UI
  private let card         = UIView()
  private let imageView    = UIImageView()
  private let spinner      = UIActivityIndicatorView(style: .medium)
  private let expenseBtn   = UIButton(type: .system)
  private let splitBtn     = UIButton(type: .system)

  // MARK: - Lifecycle

  override func viewDidLoad() {
    super.viewDidLoad()
    setupUI()
    loadImage()
  }

  // MARK: - UI

  private func setupUI() {
    view.backgroundColor = UIColor.black.withAlphaComponent(0.6)

    // ── Card ──
    card.backgroundColor = UIColor(red: 0.08, green: 0.08, blue: 0.08, alpha: 1)
    card.layer.cornerRadius = 24
    card.layer.shadowColor  = UIColor.black.cgColor
    card.layer.shadowOpacity = 0.5
    card.layer.shadowRadius  = 24
    card.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(card)

    // ── Header row ──
    let iconView = UIImageView()
    iconView.image       = loadAppIcon() ?? UIImage(systemName: "dollarsign.circle.fill")
    iconView.tintColor   = .systemBlue
    iconView.contentMode = .scaleAspectFill
    iconView.layer.cornerRadius = 12
    iconView.clipsToBounds = true
    iconView.translatesAutoresizingMaskIntoConstraints = false

    let titleLabel       = UILabel()
    titleLabel.text      = "Add to Expensify"
    titleLabel.font      = .boldSystemFont(ofSize: 17)
    titleLabel.textColor = .white
    titleLabel.translatesAutoresizingMaskIntoConstraints = false

    let header = UIStackView(arrangedSubviews: [iconView, titleLabel])
    header.axis      = .horizontal
    header.spacing   = 10
    header.alignment = .center
    header.translatesAutoresizingMaskIntoConstraints = false
    card.addSubview(header)

    // ── Image preview ──
    imageView.contentMode    = .scaleAspectFill
    imageView.backgroundColor = UIColor(white: 0.15, alpha: 1)
    imageView.layer.cornerRadius = 16
    imageView.clipsToBounds  = true
    imageView.translatesAutoresizingMaskIntoConstraints = false
    card.addSubview(imageView)

    spinner.hidesWhenStopped = true
    spinner.color = .lightGray
    spinner.startAnimating()
    spinner.translatesAutoresizingMaskIntoConstraints = false
    imageView.addSubview(spinner)

    // ── Buttons ──
    configureButton(expenseBtn,
                    title: "Expense",
                    filled: true)
    expenseBtn.addTarget(self, action: #selector(expenseTapped), for: .touchUpInside)

    configureButton(splitBtn,
                    title: "Split",
                    filled: false)
    splitBtn.addTarget(self, action: #selector(splitTapped), for: .touchUpInside)

    let btnRow = UIStackView(arrangedSubviews: [expenseBtn, splitBtn])
    btnRow.axis         = .horizontal
    btnRow.spacing      = 12
    btnRow.distribution = .fillEqually
    btnRow.translatesAutoresizingMaskIntoConstraints = false
    card.addSubview(btnRow)

    // ── Cancel ──
    let cancelBtn = UIButton(type: .system)
    cancelBtn.setTitle("Cancel", for: .normal)
    cancelBtn.titleLabel?.font = .systemFont(ofSize: 15)
    cancelBtn.setTitleColor(UIColor(white: 1, alpha: 0.35), for: .normal)
    cancelBtn.translatesAutoresizingMaskIntoConstraints = false
    cancelBtn.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)
    card.addSubview(cancelBtn)

    NSLayoutConstraint.activate([
      card.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
      card.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
      card.centerYAnchor.constraint(equalTo: view.centerYAnchor),

      iconView.widthAnchor.constraint(equalToConstant: 34),
      iconView.heightAnchor.constraint(equalToConstant: 34),

      header.topAnchor.constraint(equalTo: card.topAnchor, constant: 22),
      header.centerXAnchor.constraint(equalTo: card.centerXAnchor),

      imageView.topAnchor.constraint(equalTo: header.bottomAnchor, constant: 16),
      imageView.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
      imageView.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
      imageView.heightAnchor.constraint(equalToConstant: 210),

      spinner.centerXAnchor.constraint(equalTo: imageView.centerXAnchor),
      spinner.centerYAnchor.constraint(equalTo: imageView.centerYAnchor),

      btnRow.topAnchor.constraint(equalTo: imageView.bottomAnchor, constant: 18),
      btnRow.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: 16),
      btnRow.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -16),
      btnRow.heightAnchor.constraint(equalToConstant: 50),

      cancelBtn.topAnchor.constraint(equalTo: btnRow.bottomAnchor, constant: 4),
      cancelBtn.centerXAnchor.constraint(equalTo: card.centerXAnchor),
      cancelBtn.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -18),
    ])
  }

  private func configureButton(_ btn: UIButton, title: String, filled: Bool) {
    btn.setTitle(title, for: .normal)
    btn.titleLabel?.font = .boldSystemFont(ofSize: 15)
    btn.layer.cornerRadius = 13
    btn.isEnabled = false
    btn.alpha = 0.38

    if filled {
      btn.backgroundColor = UIColor(red: 0.10, green: 0.28, blue: 0.41, alpha: 1) // #194868
      btn.setTitleColor(.white, for: .normal)
      btn.setTitleColor(UIColor(white: 1, alpha: 0.5), for: .disabled)
    } else {
      btn.backgroundColor = UIColor(white: 1, alpha: 0.07)
      btn.layer.borderWidth = 1.5
      btn.layer.borderColor = UIColor(white: 1, alpha: 0.25).cgColor
      btn.setTitleColor(UIColor(white: 1, alpha: 0.85), for: .normal)
      btn.setTitleColor(UIColor(white: 1, alpha: 0.3), for: .disabled)
    }
    btn.translatesAutoresizingMaskIntoConstraints = false
  }

  // MARK: - Icon loading

  /// Loads the app icon from the extension's compiled asset catalog.
  private func loadAppIcon() -> UIImage? {
    // Asset catalog (Assets.xcassets/AppIcon.imageset) — compiled into extension bundle
    if let img = UIImage(named: "AppIcon", in: Bundle(for: ShareViewController.self), with: nil) { return img }
    // Fallback: loose PNG resource
    if let path = Bundle.main.path(forResource: "AppIcon", ofType: "png"),
       let img = UIImage(contentsOfFile: path) { return img }
    return nil
  }

  // MARK: - Image loading

  private func loadImage() {
    guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
          let attachments = item.attachments else { cancelTapped(); return }

    let types = [UTType.jpeg.identifier, UTType.png.identifier, UTType.image.identifier]
    for attachment in attachments {
      for type in types where attachment.hasItemConformingToTypeIdentifier(type) {
        attachment.loadItem(forTypeIdentifier: type, options: nil) { [weak self] loaded, error in
          DispatchQueue.main.async {
            guard let self, error == nil else { return }
            var data: Data?
            if let url = loaded as? URL         { data = try? Data(contentsOf: url) }
            else if let img = loaded as? UIImage { data = img.jpegData(compressionQuality: 0.85) }
            else if let raw = loaded as? Data    { data = raw }
            guard let imageData = data else { return }
            self.loadedImageData = imageData
            self.imageView.image = UIImage(data: imageData)
            self.spinner.stopAnimating()
            // Enable both buttons
            [self.expenseBtn, self.splitBtn].forEach { btn in
              btn.isEnabled = true
              UIView.animate(withDuration: 0.25) { btn.alpha = 1 }
            }
          }
        }
        return
      }
    }
    cancelTapped()
  }

  // MARK: - Actions

  @objc private func expenseTapped() { commit(action: "transaction") }
  @objc private func splitTapped()   { commit(action: "split") }

  private func commit(action: String) {
    guard let data = loadedImageData,
          let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupId) else {
      cancelTapped(); return
    }

    do {
      try data.write(to: containerURL.appendingPathComponent(imageFileName), options: .atomic)
    } catch {
      cancelTapped(); return
    }

    if let defaults = UserDefaults(suiteName: appGroupId) {
      defaults.set(true,   forKey: pendingKey)
      defaults.set(action, forKey: actionKey)
      defaults.synchronize()
    }

    [expenseBtn, splitBtn].forEach { $0.isEnabled = false }
    openMainApp()
  }

  // MARK: - App opening (same three-attempt strategy as before)

  private func openMainApp() {
    let url = URL(string: "expensify://share")!
    let directOpened = openViaResponderChain(url: url) || openViaObjCRuntime(url: url)

    if directOpened {
      scheduleNotification(delay: 4.0, thenComplete: false)
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) { [weak self] in
        self?.completeExtension()
      }
      return
    }

    DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) { [weak self] in
      guard let self, !self.extensionCompleted else { return }
      let stillPending = UserDefaults(suiteName: self.appGroupId)?
        .bool(forKey: self.pendingKey) ?? true
      if stillPending {
        self.scheduleNotification(delay: 0.5, thenComplete: true)
      } else {
        self.completeExtension()
      }
    }

    extensionContext?.open(url) { [weak self] success in
      guard let self, !self.extensionCompleted else { return }
      if success { self.completeExtension() }
    }
  }

  private func openViaResponderChain(url: URL) -> Bool {
    var r: UIResponder? = self
    while let responder = r {
      if let app = responder as? UIApplication {
        app.open(url, options: [:], completionHandler: nil)
        return true
      }
      r = responder.next
    }
    return false
  }

  private func openViaObjCRuntime(url: URL) -> Bool {
    guard let cls = NSClassFromString("UIApplication") as? NSObject.Type else { return false }
    let sel = NSSelectorFromString("sharedApplication")
    guard cls.responds(to: sel) else { return false }
    guard let app = cls.perform(sel)?.takeUnretainedValue() as? UIApplication else { return false }
    app.open(url, options: [:], completionHandler: nil)
    return true
  }

  private func scheduleNotification(delay: TimeInterval, thenComplete: Bool) {
    UNUserNotificationCenter.current().getNotificationSettings { [weak self] settings in
      guard let self else { return }
      let ok = [UNAuthorizationStatus.authorized, .provisional, .ephemeral]
        .contains(settings.authorizationStatus)
      guard ok else {
        if thenComplete { self.completeExtension() }
        return
      }

      let content      = UNMutableNotificationContent()
      content.title    = "Receipt saved"
      content.body     = "Tap to add it as an expense in Expensify"
      content.sound    = .default
      let trigger      = UNTimeIntervalNotificationTrigger(timeInterval: delay, repeats: false)
      let request      = UNNotificationRequest(identifier: "expensify-pending-share",
                                               content: content, trigger: trigger)
      UNUserNotificationCenter.current().add(request) { [weak self] _ in
        if thenComplete { self?.completeExtension() }
      }
    }
  }

  private func completeExtension() {
    guard !extensionCompleted else { return }
    extensionCompleted = true
    extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
  }

  @objc private func cancelTapped() { completeExtension() }
}
