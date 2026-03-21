import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import List "mo:core/List";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Iter "mo:core/Iter";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  type UserProfile = {
    name : Text;
  };

  type UserProfileInfo = {
    name : Text;
    principal : Principal;
    isAdmin : Bool;
    isAdminPlus : Bool;
  };

  type AdminInfo = {
    name : Text;
    principal : Principal;
    isAdminPlus : Bool;
  };

  var accessControlState = AccessControl.initState();
  var grantedAdminsList = List.empty<Principal>();
  var adminPlusList = List.empty<Principal>();
  var firstUserId : ?Principal = null;
  var userProfiles = Map.empty<Principal, UserProfile>();
  var conceptMachineVisible = true;
  var loggerIdLoggerLabels = Map.empty<Nat, Text>();
  var sensorGroupsPerIdJson = Map.empty<Nat, Text>();
  var advancedChartConfigPerIdJson = Map.empty<Nat, Text>();

  // Kept for upgrade compatibility (stable let binding from previous version)
  let HARDCODED_ADMIN = Principal.fromText("nq44w-zh7mz-vkidk-kanua-rfijv-g2ail-o6b4k-ts6iu-qwwlh-e4le5-vqe");

  // Active hardcoded admins (always admin + admin+, cannot be removed)
  let HARDCODED_ADMIN_1 = Principal.fromText("fg6ne-pkkfz-k4dmi-5hzd2-hqazu-h57zu-khkfk-76a5q-w3wwu-tk27f-qae");
  let HARDCODED_ADMIN_2 = Principal.fromText("r3ppw-axxru-frxvf-c52x6-sjbka-5id2k-kgntf-g4tdu-wqdtq-v5tsj-tqe");

  var sensorLabels = Map.empty<Text, Text>();
  include MixinAuthorization(accessControlState);

  func isHardcodedAdmin(pr : Principal) : Bool {
    pr == HARDCODED_ADMIN or pr == HARDCODED_ADMIN_1 or pr == HARDCODED_ADMIN_2;
  };

  func isEffectiveAdmin(pr : Principal) : Bool {
    AccessControl.isAdmin(accessControlState, pr) or isHardcodedAdmin(pr);
  };

  func isEffectiveAdminPlus(pr : Principal) : Bool {
    // Hardcoded admins are always admin+
    if (isHardcodedAdmin(pr)) { return true };
    adminPlusList.any(func(p) { p == pr });
  };

  func listContains(list : List.List<Principal>, p : Principal) : Bool {
    list.any(func(x) { x == p });
  };

  func isFirstUser(pr : Principal) : Bool {
    switch (firstUserId) {
      case (?id) { id == pr };
      case (null) { false };
    };
  };

  public query ({ caller }) func hasProfile() : async Bool {
    userProfiles.containsKey(caller);
  };

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfileInfo {
    let role = AccessControl.getUserRole(accessControlState, caller);
    let isAdmin = isEffectiveAdmin(caller);
    let isAdminPlus = isEffectiveAdminPlus(caller);

    switch (role) {
      case (#admin or #user) {
        switch (userProfiles.get(caller)) {
          case (null) { null };
          case (?profile) {
            ?{
              name = profile.name;
              principal = caller;
              isAdmin;
              isAdminPlus;
            };
          };
        };
      };
      case (#guest) {
        if (isHardcodedAdmin(caller)) {
          switch (userProfiles.get(caller)) {
            case (null) { null };
            case (?profile) {
              ?{
                name = profile.name;
                principal = caller;
                isAdmin = true;
                isAdminPlus = true;
              };
            };
          };
        } else {
          null;
        };
      };
    };
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async UserProfileInfo {
    if (not isEffectiveAdmin(caller)) {
      Runtime.trap("Unauthorized: Only admins can fetch other profiles");
    };

    let isAdmin = isEffectiveAdmin(user);
    let isAdminPlus = isEffectiveAdminPlus(user);

    switch (userProfiles.get(user), isAdmin) {
      case (?profile, _) {
        {
          name = profile.name;
          principal = user;
          isAdmin;
          isAdminPlus;
        };
      };
      case (null, true) {
        { name = "<admin user>"; principal = user; isAdmin = true; isAdminPlus };
      };
      case (null, false) { Runtime.trap("User not found.") };
    };
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user) or isHardcodedAdmin(caller))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);

    // First user becomes admin and admin+
    switch (firstUserId) {
      case (null) {
        firstUserId := ?caller;
        if (not listContains(grantedAdminsList, caller)) {
          grantedAdminsList.add(caller);
        };
        AccessControl.assignRole(accessControlState, caller, caller, #admin);
        if (not listContains(adminPlusList, caller)) {
          adminPlusList.add(caller);
        };
      };
      case (?_) {};
    };
  };

  public query ({ caller }) func getUserRole() : async ?AccessControl.UserRole {
    if (isHardcodedAdmin(caller)) {
      return ?#admin;
    };
    let role = AccessControl.getUserRole(accessControlState, caller);
    ?role;
  };

  public query ({ caller }) func isCallerAdminPlus() : async Bool {
    isEffectiveAdminPlus(caller);
  };

  public query ({ caller }) func getGoogleSheetsDownloadLink() : async Text {
    if (not isEffectiveAdmin(caller)) {
      Runtime.trap("Unauthorized: Only admins can access this resource");
    };
    "https://docs.google.com/spreadsheets/d/1qMoehnVFWOydYBkOVcIkRfVH0RWZZKXTAVjk9gvnfx0/edit?usp=sharing";
  };

  public query ({ caller }) func getAllAdmins() : async [AdminInfo] {
    if (not isEffectiveAdmin(caller)) {
      Runtime.trap("Unauthorized: Only admins can fetch all admins");
    };

    let uniqueAdmins = Map.empty<Principal, Bool>();
    uniqueAdmins.add(HARDCODED_ADMIN_1, true);
    uniqueAdmins.add(HARDCODED_ADMIN_2, true);

    for (admin in grantedAdminsList.toArray().vals()) {
      uniqueAdmins.add(admin, true);
    };

    let adminInfos = uniqueAdmins.keys().map(
      func(principal : Principal) : AdminInfo {
        let isAdminPlus = isEffectiveAdminPlus(principal);
        switch (userProfiles.get(principal)) {
          case (?profile) {
            { name = profile.name; principal; isAdminPlus };
          };
          case (null) {
            { name = "<admin user>"; principal; isAdminPlus };
          };
        };
      }
    ).toArray();

    adminInfos;
  };

  public shared ({ caller }) func grantAdminRole(target : Principal) : async Bool {
    if (not isEffectiveAdmin(caller)) {
      Runtime.trap("Unauthorized: Only admins can grant admin role");
    };

    if (isHardcodedAdmin(target)) {
      return true;
    };

    AccessControl.assignRole(accessControlState, caller, target, #admin);

    if (not listContains(grantedAdminsList, target)) {
      grantedAdminsList.add(target);
    };

    true;
  };

  public shared ({ caller }) func grantAdminPlusRole(target : Principal) : async Bool {
    if (not isEffectiveAdminPlus(caller)) {
      Runtime.trap("Unauthorized: Only admin+ users can grant admin+ role");
    };

    if (not isEffectiveAdmin(target)) {
      Runtime.trap("Target must already be an admin");
    };

    if (not listContains(adminPlusList, target)) {
      adminPlusList.add(target);
    };

    true;
  };

  public shared ({ caller }) func revokeAdminRole(target : Principal) : async Bool {
    if (not isEffectiveAdminPlus(caller)) {
      Runtime.trap("Unauthorized: Only admin+ users can remove admins");
    };

    if (isHardcodedAdmin(target)) {
      Runtime.trap("Cannot remove a hardcoded admin");
    };

    if (isFirstUser(target)) {
      Runtime.trap("Cannot remove the first user");
    };

    grantedAdminsList := grantedAdminsList.filter(func(p) { p != target });
    AccessControl.assignRole(accessControlState, caller, target, #user);

    true;
  };

  public query ({ caller }) func getGrantedAdmins() : async [Principal] {
    if (not isEffectiveAdmin(caller)) {
      Runtime.trap("Unauthorized: Only admins can fetch the list");
    };

    let uniqueAdmins = Map.empty<Principal, Bool>();
    uniqueAdmins.add(HARDCODED_ADMIN_1, true);
    uniqueAdmins.add(HARDCODED_ADMIN_2, true);

    for (admin in grantedAdminsList.toArray().vals()) {
      uniqueAdmins.add(admin, true);
    };

    uniqueAdmins.keys().toArray();
  };

  public query ({ caller }) func isConceptMachineVisible() : async Bool {
    conceptMachineVisible;
  };

  public shared ({ caller }) func setConceptMachineVisible(visible : Bool) : async () {
    if (not isEffectiveAdmin(caller)) {
      Runtime.trap("Unauthorized: Only admins can change ConceptMachine visibility");
    };
    conceptMachineVisible := visible;
  };

  public query ({ caller }) func getAllLoggerLabels() : async [(Nat, Text)] {
    if (not isEffectiveAdmin(caller)) {
      Runtime.trap("Unauthorized: Only admins may query logger labels");
    };
    loggerIdLoggerLabels.toArray();
  };

  public shared ({ caller }) func setLoggerIdLabel(id : Nat, loggerLabel : Text) : async () {
    if (not isEffectiveAdmin(caller)) {
      Runtime.trap("Unauthorized: Only admins can set logger labels");
    };
    loggerIdLoggerLabels.add(id, loggerLabel);
  };

  public query ({ caller }) func getAllSensorLabelsForId(loggerId : Nat) : async [(Nat, Text)] {
    if (not isEffectiveAdmin(caller)) {
      Runtime.trap("Unauthorized: Only admins may query sensor labels");
    };
    if (loggerId < 1 or loggerId > 10) {
      Runtime.trap("Logger ID must be 1-10. ");
    };
    let filteredEntries = sensorLabels.entries().filter(
      func((key, _)) {
        key.startsWith(#text(loggerId.toText() # ":"));
      }
    );

    let result = filteredEntries.map(
      func((key, value)) {
        let parts = key.split(#char(':')).toArray();
        if (parts.size() == 2) {
          switch (Nat.fromText(parts[1])) {
            case (?sensorNum) {
              (sensorNum, value);
            };
            case (null) { (0, value) };
          };
        } else {
          (0, value);
        };
      }
    );

    result.toArray();
  };

  public shared ({ caller }) func setSensorLabel(loggerId : Nat, sensorNum : Nat, sensorLabel : Text) : async () {
    if (not isEffectiveAdmin(caller)) {
      Runtime.trap("Unauthorized: Only admins can set sensor labels");
    };

    if (loggerId < 1 or loggerId > 10) {
      Runtime.trap("Logger ID must be 1-10. ");
    };

    if (sensorNum < 1 or sensorNum > 72) {
      Runtime.trap("Sensor number must be between 1 and 72");
    };

    let key = loggerId.toText() # ":" # sensorNum.toText();
    sensorLabels.add(key, sensorLabel);
  };

  public shared ({ caller }) func resetSensorLabelsForId(loggerId : Nat) : async () {
    if (not isEffectiveAdmin(caller)) {
      Runtime.trap("Unauthorized: Only admins can reset sensor labels for id. ");
    };

    if (loggerId < 1 or loggerId > 10) {
      Runtime.trap("Logger ID must be 1-10. ");
    };

    let newSensorLabels = sensorLabels.filter(
      func(key, _) {
        not key.startsWith(#text(loggerId.toText() # ":"));
      }
    );

    sensorLabels := newSensorLabels;
  };

  public query ({ caller }) func getSensorGroupsForId(id : Nat) : async Text {
    if (not isEffectiveAdmin(caller)) {
      Runtime.trap("Unauthorized: Only admins can query sensor groups");
    };
    switch (sensorGroupsPerIdJson.get(id)) {
      case (null) { "" };
      case (?json) { json };
    };
  };

  public shared ({ caller }) func saveSensorGroupsForId(id : Nat, json : Text) : async () {
    if (not isEffectiveAdmin(caller)) {
      Runtime.trap("Unauthorized: Only admins can save sensor groups");
    };
    sensorGroupsPerIdJson.add(id, json);
  };

  public query ({ caller }) func getAdvancedChartConfigForId(id : Nat) : async Text {
    if (not isEffectiveAdmin(caller)) {
      Runtime.trap("Unauthorized: Only admins can query advanced chart config");
    };
    switch (advancedChartConfigPerIdJson.get(id)) {
      case (null) { "" };
      case (?json) { json };
    };
  };

  public shared ({ caller }) func saveAdvancedChartConfigForId(id : Nat, json : Text) : async () {
    if (not isEffectiveAdmin(caller)) {
      Runtime.trap("Unauthorized: Only admins can save advanced chart config");
    };
    advancedChartConfigPerIdJson.add(id, json);
  };
};
