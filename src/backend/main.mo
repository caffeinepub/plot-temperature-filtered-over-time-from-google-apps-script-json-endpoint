import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Text "mo:core/Text";


import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

// Apply migration on upgrade

actor {
  type UserProfile = {
    name : Text;
  };

  type UserProfileInfo = {
    name : Text;
    principal : Principal;
    isAdmin : Bool;
  };

  type AdminInfo = {
    name : Text;
    principal : Principal;
  };

  var accessControlState = AccessControl.initState();
  var grantedAdminsList = List.empty<Principal>();
  var userProfiles = Map.empty<Principal, UserProfile>();
  var conceptMachineVisible = true;
  var loggerIdLoggerLabels = Map.empty<Nat, Text>();
  var sensorLabels = Map.empty<Nat, Text>();
  var sensorGroupsPerIdJson = Map.empty<Nat, Text>();

  let HARDCODED_ADMIN = Principal.fromText("nq44w-zh7mz-vkidk-kanua-rfijv-g2ail-o6b4k-ts6iu-qwwlh-e4le5-vqe");

  include MixinAuthorization(accessControlState);

  func isHardcodedAdmin(pr : Principal) : Bool {
    pr == HARDCODED_ADMIN;
  };

  func isEffectiveAdmin(pr : Principal) : Bool {
    AccessControl.isAdmin(accessControlState, pr) or isHardcodedAdmin(pr);
  };

  func listContainsAdmin(list : List.List<Principal>, admin : Principal) : Bool {
    list.any(func(p) { p == admin });
  };

  public query ({ caller }) func hasProfile() : async Bool {
    userProfiles.containsKey(caller);
  };

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfileInfo {
    let role = AccessControl.getUserRole(accessControlState, caller);
    let isAdmin = isEffectiveAdmin(caller);

    switch (role) {
      case (#admin or #user) {
        switch (userProfiles.get(caller)) {
          case (null) { null };
          case (?profile) {
            ?{
              name = profile.name;
              principal = caller;
              isAdmin;
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

    switch (userProfiles.get(user), isAdmin) {
      case (?profile, _) {
        {
          name = profile.name;
          principal = user;
          isAdmin;
        };
      };
      case (null, true) {
        { name = "<admin user>"; principal = user; isAdmin = true };
      };
      case (null, false) { Runtime.trap("User not found.") };
    };
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user) or isHardcodedAdmin(caller))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  public query ({ caller }) func getUserRole() : async ?AccessControl.UserRole {
    if (isHardcodedAdmin(caller)) {
      return ?#admin;
    };
    let role = AccessControl.getUserRole(accessControlState, caller);
    ?role;
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

    let grantedAdminsArray = grantedAdminsList.toArray();

    let uniqueAdmins = Map.empty<Principal, Bool>();
    uniqueAdmins.add(HARDCODED_ADMIN, true);

    for (admin in grantedAdminsArray.vals()) {
      uniqueAdmins.add(admin, true);
    };

    let adminInfos = uniqueAdmins.keys().map(
      func(principal : Principal) : AdminInfo {
        switch (userProfiles.get(principal)) {
          case (?profile) {
            { name = profile.name; principal };
          };
          case (null) {
            { name = "<admin user>"; principal };
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

    if (isHardcodedAdmin(caller)) {
      AccessControl.assignRole(accessControlState, caller, target, #admin);
    } else {
      AccessControl.assignRole(accessControlState, caller, target, #admin);
    };

    if (not listContainsAdmin(grantedAdminsList, target)) {
      grantedAdminsList.add(target);
    };

    true;
  };

  public query ({ caller }) func getGrantedAdmins() : async [Principal] {
    if (not isEffectiveAdmin(caller)) {
      Runtime.trap("Unauthorized: Only admins can fetch the list");
    };

    let uniqueAdmins = Map.empty<Principal, Bool>();
    uniqueAdmins.add(HARDCODED_ADMIN, true);

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

  // ========= SENSOR LABELS =========
  public query ({ caller }) func getAllSensorLabels() : async [(Nat, Text)] {
    if (not isEffectiveAdmin(caller)) {
      Runtime.trap("Unauthorized: Only admins may query sensor labels");
    };
    sensorLabels.toArray();
  };

  public shared ({ caller }) func setSensorLabel(sensorNum : Nat, sensorLabel : Text) : async () {
    if (not isEffectiveAdmin(caller)) {
      Runtime.trap("Unauthorized: Only admins can set sensor labels");
    };

    if (sensorNum < 1 or sensorNum > 72) {
      Runtime.trap("Sensor number must be between 1 and 72");
    };

    sensorLabels.add(sensorNum, sensorLabel);
  };

  public shared ({ caller }) func resetSensorLabels() : async () {
    if (not isEffectiveAdmin(caller)) {
      Runtime.trap("Unauthorized: Only admins can reset ALL sensor labels!");
    };
    sensorLabels := Map.empty<Nat, Text>();
  };

  // ========= SENSOR GROUPS =========
  public query func getSensorGroupsForId(id : Nat) : async Text {
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
};
