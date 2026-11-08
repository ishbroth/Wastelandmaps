// Turns CarPlay on in the iPhone app, once Apple has granted the CarPlay (navigation) entitlement for com.wasteland.app. Read CARPLAY.md first.
//   node _tools/enable-carplay.mjs          (then commit, push, and run the TestFlight workflow)
// It adds: the car-screen scene to Info.plist, an App.entitlements file with com.apple.developer.carplay-maps, and points the Xcode project at that file.
// Until it is run, the app has no CarPlay entitlement and the car-screen code in ios/App/App never runs.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(ROOT, f), s);

// 1. Info.plist: the CarPlay scene
const plistFile = 'ios/App/App/Info.plist';
let plist = read(plistFile);
if (plist.includes('CPTemplateApplicationSceneSessionRoleApplication')) console.log('Info.plist already has the CarPlay scene');
else {
  const marker = '\t\t\t<key>UIWindowSceneSessionRoleApplication</key>';
  if (!plist.includes('UIWindowSceneSessionRoleApplication')) throw new Error('Info.plist has no window scene configuration to put the CarPlay one beside');
  const carScene = `    <key>CPTemplateApplicationSceneSessionRoleApplication</key>
      <array>
        <dict>
            <key>UISceneClassName</key>
            <string>CPTemplateApplicationScene</string>
            <key>UISceneConfigurationName</key>
            <string>CarPlay</string>
            <key>UISceneDelegateClassName</key>
            <string>$(PRODUCT_MODULE_NAME).CarPlaySceneDelegate</string>
        </dict>
      </array>
`;
  const at = plist.indexOf('<key>UIWindowSceneSessionRoleApplication</key>');
  const lineStart = plist.lastIndexOf('\n', at) + 1;
  plist = plist.slice(0, lineStart) + carScene + plist.slice(lineStart);
  write(plistFile, plist);
  console.log('Info.plist: added the CarPlay scene');
}

// 2. the entitlement
const entFile = 'ios/App/App/App.entitlements';
if (fs.existsSync(path.join(ROOT, entFile))) console.log('App.entitlements already exists: check it has com.apple.developer.carplay-maps');
else {
  write(entFile, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>com.apple.developer.carplay-maps</key>
	<true/>
</dict>
</plist>
`);
  console.log('created App.entitlements');
}

// 3. the Xcode project uses it (both the Debug and Release settings of the App target)
const projFile = 'ios/App/App.xcodeproj/project.pbxproj';
let proj = read(projFile);
if (proj.includes('CODE_SIGN_ENTITLEMENTS')) console.log('the Xcode project already names an entitlements file');
else {
  const before = proj;
  proj = proj.replace(/(\t\t\t\tCODE_SIGN_STYLE = [A-Za-z]+;\n)/g, '$1\t\t\t\tCODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n');
  if (proj === before) throw new Error('could not find the signing settings in the Xcode project: add CODE_SIGN_ENTITLEMENTS = App/App.entitlements to the App target by hand');
  // the file itself, so it shows in the project
  const ref = 'C0A1B1E0FEFE0000000000AA';
  proj = proj.replace('/* Begin PBXFileReference section */\n', `/* Begin PBXFileReference section */\n\t\t${ref} /* App.entitlements */ = {isa = PBXFileReference; lastKnownFileType = text.plist.entitlements; path = App.entitlements; sourceTree = "<group>"; };\n`);
  proj = proj.replace('\t\t\t\t9582B6822FE993A50072D4E8 /* SceneDelegate.swift */,\n', `\t\t\t\t9582B6822FE993A50072D4E8 /* SceneDelegate.swift */,\n\t\t\t\t${ref} /* App.entitlements */,\n`);
  write(projFile, proj);
  console.log('Xcode project: now signs with App.entitlements');
}
console.log('Done. Commit and push, then run the "iOS build to TestFlight" workflow. The provisioning profile must include CarPlay: see CARPLAY.md.');
