import Map "mo:core/Map";

module {
  type OldActor = {
    sensorLabels : Map.Map<Nat, Text>;
  };

  type NewActor = {
    sensorLabels : Map.Map<Text, Text>;
  };

  public func run(_ : OldActor) : NewActor {
    let newSensorLabels = Map.empty<Text, Text>();
    { sensorLabels = newSensorLabels };
  };
};
