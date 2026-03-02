import Map "mo:core/Map";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import AccessControl "authorization/access-control";

module {
  type OldActor = {
    var accessControlState : AccessControl.AccessControlState;
    var userProfiles : Map.Map<Principal, { name : Text }>;
    var grantedAdminsList : List.List<Principal>;
    var conceptMachineVisible : Bool;
  };

  public type NewActor = {
    var accessControlState : AccessControl.AccessControlState;
    var userProfiles : Map.Map<Principal, { name : Text }>;
    var grantedAdminsList : List.List<Principal>;
    var conceptMachineVisible : Bool;
    var loggerIdLoggerLabels : Map.Map<Nat, Text>;
  };

  public func run(old : OldActor) : NewActor {
    {
      var accessControlState = old.accessControlState;
      var userProfiles = old.userProfiles;
      var grantedAdminsList = old.grantedAdminsList;
      var conceptMachineVisible = old.conceptMachineVisible;
      var loggerIdLoggerLabels = Map.empty<Nat, Text>();
    };
  };
};
