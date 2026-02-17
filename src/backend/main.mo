import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Iter "mo:core/Iter";
import Text "mo:core/Text";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Blob "mo:core/Blob";
import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";

actor {
  type UserProfile = {
    name : Text;
    // Other user metadata if needed
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

  // Stable variables for upgrade persistence
  var accessControlState = AccessControl.initState();
  var grantedAdminsList = List.empty<Principal>();

  var userProfiles = Map.empty<Principal, UserProfile>();

  let HARDCODED_ADMIN = Principal.fromText("nq44w-zh7mz-vkidk-kanua-rfijv-g2ail-o6b4k-ts6iu-qwwlh-e4le5-vqe");

  func isHardcodedAdmin(principal : Principal) : Bool {
    Principal.equal(principal, HARDCODED_ADMIN);
  };

  func listContainsAdmin(list : List.List<Principal>, admin : Principal) : Bool {
    list.any(func(p) { p == admin });
  };

  // Initialize first user as admin
  func ensureInitialized(caller : Principal) {
    if (not listContainsAdmin(grantedAdminsList, HARDCODED_ADMIN)) {
      grantedAdminsList.add(HARDCODED_ADMIN);
    };
  };

  include MixinAuthorization(accessControlState);

  public query ({ caller }) func hasProfile() : async Bool {
    ensureInitialized(caller);
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can check profile status");
    };
    userProfiles.containsKey(caller);
  };

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfileInfo {
    ensureInitialized(caller);
    let role = AccessControl.getUserRole(accessControlState, caller);
    switch (role) {
      case (#admin or #user) {
        switch (userProfiles.get(caller)) {
          case (null) { null };
          case (?profile) {
            ?{
              name = profile.name;
              principal = caller;
              isAdmin = AccessControl.isAdmin(accessControlState, caller);
            };
          };
        };
      };
      case (_) { null };
    };
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async UserProfileInfo {
    ensureInitialized(caller);
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can fetch other profiles");
    };

    let isAdmin = AccessControl.isAdmin(accessControlState, user);

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
      case (null, false) { Runtime.trap("User not found") };
    };
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    ensureInitialized(caller);
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  public query ({ caller }) func getUserRole() : async ?AccessControl.UserRole {
    ensureInitialized(caller);
    let role = AccessControl.getUserRole(accessControlState, caller);
    ?role;
  };

  public query ({ caller }) func getGoogleSheetsDownloadLink() : async Text {
    ensureInitialized(caller);
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can access this resource");
    };
    "https://docs.google.com/spreadsheets/d/1RkaeHoSmQJGZAvkeXcDxd59OrdPsEQQWmKYz_1_mbZQ";
  };

  public query ({ caller }) func getAllAdmins() : async [AdminInfo] {
    ensureInitialized(caller);
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can fetch all admins");
    };

    let grantedAdminsArray = grantedAdminsList.toArray();
    
    // Deduplicate admins
    let uniqueAdmins = Map.empty<Principal, Bool>();
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
    ensureInitialized(caller);
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can grant admin role");
    };

    // Grant the admin role through AccessControl
    AccessControl.assignRole(accessControlState, caller, target, #admin);

    // Track granted admins for listing purposes (avoid duplicates)
    if (not listContainsAdmin(grantedAdminsList, target)) {
      grantedAdminsList.add(target);
    };

    true;
  };

  public query ({ caller }) func getGrantedAdmins() : async [Principal] {
    ensureInitialized(caller);
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can fetch the list");
    };
    grantedAdminsList.toArray();
  };
};
