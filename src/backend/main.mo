import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Iter "mo:core/Iter";
import Text "mo:core/Text";
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
    principal : Principal;
    name : Text;
  };

  let userProfiles = Map.empty<Principal, UserProfile>();
  let accessControlState = AccessControl.initState();

  include MixinAuthorization(accessControlState);

  public query ({ caller }) func hasProfile() : async Bool {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can check profile status");
    };
    userProfiles.containsKey(caller);
  };

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfileInfo {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
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

  public query ({ caller }) func getUserProfile(user : Principal) : async UserProfileInfo {
    if (not (AccessControl.isAdmin(accessControlState, caller))) {
      Runtime.trap("Unauthorized: Only admins can view other profiles");
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
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  public query ({ caller }) func getUserRole() : async ?AccessControl.UserRole {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can query roles");
    };
    let role = AccessControl.getUserRole(accessControlState, caller);
    ?role;
  };

  public query ({ caller }) func getGoogleSheetsDownloadLink() : async Text {
    // Use strict admin check for this as only admins are supposed to access this file
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can access this resource");
    };
    "https://docs.google.com/spreadsheets/d/1RkaeHoSmQJGZAvkeXcDxd59OrdPsEQQWmKYz_1_mbZQ";
  };

  public query ({ caller }) func getAllAdmins() : async [AdminInfo] {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can access this resource");
    };

    let adminsIter = userProfiles.entries().filter(
      func((principal, _profile)) {
        return AccessControl.isAdmin(accessControlState, principal);
      }
    );

    let mappedAdminsIter = adminsIter.map(
      func((principal, profile)) {
        {
          principal;
          name = profile.name;
        };
      }
    );
    mappedAdminsIter.toArray();
  };
};
