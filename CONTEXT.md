# Dependency composition and resource ownership

This context describes how applications assemble services and assign
responsibility for their acquired resources.

## Language

**Service**:
A value made available to other parts of an application through dependency
composition. A service is not its provider or its ownership policy.
_Avoid_: Factory when referring to the resulting value

**Provider**:
A declaration of how a service is obtained, including the policies governing
its acquisition and ownership.
_Avoid_: Instance, resource

**Factory**:
The service-creation callback within a provider. Its declared dependencies are
the services it needs to create its result.
_Avoid_: Provider when referring only to the callback

**Token**:
The identity by which a provided service and its consumers agree on a
dependency.
_Avoid_: Alias when identity rather than an alternative name is intended

**Module**:
A reusable unit of service composition with exported services and requirements
that its surrounding application must satisfy.
_Avoid_: Bag when referring to a reusable declaration

**Bag**:
A resolvable service composition with its own acquisition and resource-ownership
context.
_Avoid_: Module, registration map

**Acquisition**:
One attempt to obtain a service instance from its provider. Distinct
acquisitions may use the same provider and have distinct cleanup obligations.
_Avoid_: Registration when referring to a created instance

**Acquisition stage**:
A source or transformation result within one acquisition, with its own rule for
when a resource is ready and which value an attached owner receives.
_Avoid_: Factory when referring to a later transformation result

**Acquired value**:
The resource accepted for ownership at one acquisition stage. It may differ
from the exposed service when that service represents pending acquisition.
_Avoid_: Resolved service when the distinction from the exposed value matters

**Owned resource**:
A successfully acquired value whose cleanup responsibility was explicitly
accepted by a bag or another application owner.
_Avoid_: Disposable object when merely having a cleanup method is meant

**Borrowed resource**:
A value used without accepting responsibility for its cleanup. Its actual
owner must keep it available for the duration of the borrowing work.
_Avoid_: Unmanaged resource

**Sharing**:
Reusing an existing instance, including the dependencies already bound to it.
Sharing is distinct from recreating the same provider in another context.
_Avoid_: Inheritance when a shared instance is intended

**Presence**:
Whether a value or metadata channel contains an intentionally supplied value.
A present undefined value is distinct from an absent channel.
_Avoid_: Truthiness, non-nullness
